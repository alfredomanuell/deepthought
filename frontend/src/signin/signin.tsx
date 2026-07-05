import { Link, useSearchParams } from "react-router-dom"
import CustomButton from "../components/CustomButton"
import { API_BASE_URL } from "../config/api"

export default function SignIn() {
	const fortyTwoLoginUrl = `${API_BASE_URL}/auth/42/login`
	const [searchParams] = useSearchParams()
	const oauthError = searchParams.get('oauthError')

	return (
			<div className="relative px-8 w-full max-w-[500px] space-y-16 pt-8 bg-neutral_contrast flex items-center justify-between flex-col text-center  border-b-8 border-r-8 border-l-4 border-t-4 border-black">

				<div>

					<Link className="text-3xl sm:text-4xl font-custom text-contrast" to="/">
						Deepthought
					</Link>
					<div className="text-white/70 text-sm pt-8 pb-4 text-center font-pressStart">
						Exclusively for 42 Network students
					</div>

					{oauthError === 'not_eligible' && (
						<div className="text-red-400 text-xs font-pressStart pb-4">
							this game is just for cadets, sorry :p
						</div>
					)}
					{oauthError === '42_unavailable' && (
						<div className="text-red-400 text-xs font-pressStart pb-4">
							42 login is unavailable, try again later
						</div>
					)}

					<CustomButton route={fortyTwoLoginUrl} name="Login with 42" />

				</div>

				<div className=" flex flex-row text-center pb-4 justify-around w-full ">
					<Link className="text-xs font-pressStart text-contrast hover:text-secundary transition" to="/ToS">
						Terms of Service
					</Link>
					<Link className="text-xs font-pressStart text-contrast hover:text-secundary transition" to="/PrivacyPolicy">
						Privacy Policy
					</Link>
				</div>
				<div className="absolute right-4 bottom-4 text-xs text-white">
					v1.0
				</div>
			</div>
	)
}
