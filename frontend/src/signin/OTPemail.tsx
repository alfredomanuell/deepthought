import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import emailIcon from '../assets/open_email.png'
import { API_BASE_URL } from '../config/api'

export default function OTPEmail() {

	const [otp, setOtp] = useState('')
	const [error, setError] = useState('')
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	// userId vem do redirect OAuth quando o backend detecta isEmailVerified=false.
	const userId = searchParams.get('userId')

	async function handleVerifyOtp() {

		// Sem userId não existe forma segura de associar o OTP ao utilizador criado após OAuth.
		if (!userId) {
			setError('User not found in verification link')
			return
		}

		if (otp.length !== 6) {
			setError('Invalid OTP code')
			return
		}

		try {

			// Usa o endpoint OTP já existente no backend; não recria lógica de OTP no frontend.
			const response = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userId,
					code: otp,
				}),
			})
			const data = await response.json()

			if (!response.ok) {
				setError(data.message || 'Invalid OTP')
				return
			}

			if (!data.success || !data.accessToken || !data.refreshToken) {
				setError('Invalid OTP response')
				return
			}

			// O resto do projeto já usa localStorage.token/refreshToken para proteger /Game.
			localStorage.setItem('token', data.accessToken)
			localStorage.setItem('refreshToken', data.refreshToken)

			navigate('/Game')

		} catch {
			setError('Server error')
		}
	}

	return (
		<div className="flex flex-col items-center w-[500px] h-96 bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black">

			<div className='flex flex-col items-center'>
				<img src={emailIcon} alt="Email icon" className='w-24 h-auto' />
			</div>

			<input
				value={otp}
				onChange={(e) => {
					setOtp(e.target.value)
					setError('')
				}}
				placeholder="* * * * * *"
				className="text-center py-2 text-sm font-pressStart focus:outline-none mt-4 border-b-8 border-r-8 border-l-4 border-t-4 border-black"
				type="text"
				maxLength={6}
			/>

			<p className='pt-4 font-pressStart text-contrast text-xs'>
				Write the code sent to you.
			</p>

			{
				error &&
				<p className='text-red-500 text-xs font-pressStart pt-4'>
					{error}
				</p>
			}

			<button
				onClick={handleVerifyOtp}
				className="mt-6 px-6 py-3 bg-black text-white font-pressStart text-xs"
			>
				Verify OTP
			</button>

		</div>
	)
}
