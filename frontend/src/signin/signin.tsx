import { Link, NavLink } from "react-router"
import CustomButton from "../components/CustomButton"

export default function SignIn() {
	return (
			<div className="px-8 w-[500px] space-y-16 pt-8 bg-neutral_contrast flex items-center justify-between flex-col text-center  border-b-8 border-r-8 border-l-4 border-t-4 border-black">

				<div>

					<Link className="text-4xl font-custom text-contrast" to="/">
						Deepthought
					</Link>
					<div className="text-white/70 text-sm pt-8 pb-4 text-center font-pressStart">
						Exclusively for 42 Network students
					</div>

					<CustomButton route= "https://premiere-crook-saggy.ngrok-free.dev/auth/42/login" name="Login with 42" />
					<div className="flex flex-col pt-4">
						<NavLink className="font-pressStart text-contrast underline hover:text-secundary transition text-xs" to={"/Game"}>Open game(beta)</NavLink>
					</div>

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