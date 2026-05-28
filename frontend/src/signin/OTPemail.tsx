import { useState } from 'react'
import { useNavigate } from 'react-router'
import emailIcon from '../assets/open_email.png'

export default function OTPEmail() {

	const [otp, setOtp] = useState('')
	const [error, setError] = useState('')
	const navigate = useNavigate()

	async function handleVerifyOtp() {

		const email = localStorage.getItem('pendingEmail')

		if (!email) {
			setError('Email not found')
			return
		}

		if (otp.length !== 6) {
			setError('Invalid OTP code')
			return
		}

		try {

			const response = await fetch('http://localhost:3000/auth/verify-otp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email,
					otp,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.message || 'Invalid OTP')
				return
			}

			localStorage.setItem('token', data.accessToken)

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