import emailIcon from '../assets/open_email.png'

export default function OTPEmail() {
	return (
			<div className="flex flex-col items-center w-1/2 xl:w-2/5 h-96 bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black">
				<div className='flex flex-col items-center'>
					<img src={ emailIcon } alt="Email icon" className='w-24 h-auto'/>
				</div>
				<input className="border-b-8 border-r-8 border-l-4 border-t-4 border-black" type="poggers" />
				<p className='font-pressStart text-contrast text-xs'>Write the code sent to you.</p>
			</div>
	)
}