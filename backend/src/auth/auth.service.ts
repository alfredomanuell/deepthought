import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { SendOtpDto } from './dto/send-otp.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailer: MailerService,
  ) {}

  async signup(dto: SignupDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (userExists) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    return {
      message: 'User created',
      user: { id: user.id, email: user.email },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async sendOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.oTPCode.create({
      data: {
        email,
        code: otp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Deepthought OTP',
      text: `Your OTP code is: ${otp}`,
    });

    return {
      message: 'OTP sent',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpRecord = await this.prisma.oTPCode.findFirst({
      where: {
        email: dto.email,
        code: dto.otp,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.oTPCode.delete({
      where: {
        id: otpRecord.id,
      },
    });

    let user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: '',
        },
      });
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    return {
      accessToken,
    };
  }
}