import { useState } from 'react'
import { useNavigate } from 'react-router'
import emailIcon from '../assets/closed_email.png'

export default function EmailSignIn() {

	const [email, setEmail] = useState('')
	const [error, setError] = useState('')

	const navigate = useNavigate()

	async function handleSendOtp() {

		if (!email.includes('@')) {
			setError('Invalid email')
			return
		}

		try {

			const response = await fetch('http://localhost:3000/auth/send-otp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email }),
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.message || 'Failed to send OTP')
				return
			}

			localStorage.setItem('pendingEmail', email)

			navigate('/OTPEmail')

		} catch {
			setError('Server error')
		}
	}

	return (
		<div className="flex flex-col items-center w-[500px] h-96 bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black">

			<div className='flex flex-col items-center'>
				<img src={emailIcon} alt="Email icon" className='w-24 h-auto' />

				<p className="font-pressStart text-contrast">
					Email signin
				</p>
			</div>

			<input
				value={email}
				onChange={(e) => {
					setEmail(e.target.value)
					setError('')
				}}
				placeholder='johndoe@mail.com'
				className="text-center px-16 py-2 text-sm font-pressStart focus:outline-none border-b-8 mt-4 border-r-8 border-l-4 border-t-4 border-black"
				type="email"
			/>

			<p className='font-pressStart text-center px-6 text-contrast text-xs mt-4'>
				A code will be sent to your email.
			</p>

			{
				error &&
				<p className='text-red-500 text-xs font-pressStart mt-4'>
					{error}
				</p>
			}

			<button
				onClick={handleSendOtp}
				className="mt-6 px-6 py-3 bg-black text-white font-pressStart text-xs"
			>
				Send OTP code
			</button>

		</div>
	)
}