import emailIcon from '../assets/closed_email.png'

export default function EmailSignIn() {
	return (
			<div className="flex flex-col items-center w-1/2 xl:w-2/5 h-96 bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black">
				<div className='flex flex-col items-center'>
					<img src={ emailIcon } alt="Email icon" className='w-24 h-auto'/>
					<p className="font-pressStart text-contrast">
						Email signin
					</p>
				</div>
				<input className="border-b-8 border-r-8 border-l-4 border-t-4 border-black" type="poggers" />
				<p className='font-pressStart text-contrast text-xs'>A code will be sent to your email.</p>
			</div>
	)
}