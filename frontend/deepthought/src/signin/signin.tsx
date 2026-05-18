import { NavLink } from "react-router"
import CustomButton from "../components/CustomButton"
import CustomLink from "../components/CustomLink"

export default function SignIn() {
	// const { navigate } = useNavigate();
	return (
			<div className="w-1/2 xl:w-2/5 h-96 bg-neutral_contrast flex items-center justify-between flex-col text-center pt-4 border-b-8 border-r-8 border-l-4 border-t-4 border-black">

				<div>

					<CustomLink textSize="4xl" name="Deepthought" route="Home" highlight={false} fontName="custom"/>

					<div className="text-contrast pt-8 text-center font-pressStart">
						Exclusively for 42 Network students
					</div>

					<CustomButton name="Login with 42" />
					<div className="flex flex-col">
						<NavLink className="font-pressStart text-contrast underline hover:text-secundary transition text-xs" to={"/emailSignIn"}>Or login with email</NavLink>
						<NavLink className="font-pressStart text-contrast underline hover:text-secundary transition text-xs" to={"/"}>Open game(beta)</NavLink>
					</div>

				</div>

				<div className="flex flex-col text-center xl:flex-row pb-4 justify-around w-full ">
					<CustomLink name="Terms of Service" route="ToS" highlight={true} fontName="pressStart" textSize=""/>
				
					<CustomLink name="Privacy Policy" route="PrivacyPolicy" highlight={true} fontName="pressStart" textSize=""/>
				</div>

			</div>
	)
}