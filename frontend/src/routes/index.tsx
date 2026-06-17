import { Route, Routes } from "react-router-dom";

import App from "../App";

import EmailSignIn from "../signin/email_signin";
import SignIn from "../signin/signin";
import OTPEmail from "../signin/OTPemail";

import PhaserGame from "../components/PhaserGame";

import PrivacyPolicy from "../policy_pages/PrivacyPolicy";
import ToS from "../policy_pages/ToS";

import ProtectedRoute from '../components/ProtectedRoute'

export function AppRouter() {

	return (

		<Routes>

			<Route
				path="/"
				element={<App CustomComponent={SignIn} />}
			/>

			<Route
				path="/EmailSignIn"
				element={<App CustomComponent={EmailSignIn} />}
			/>

			<Route
				path="/OTPEmail"
				element={<App CustomComponent={OTPEmail} />}
			/>

			<Route
				path="/PrivacyPolicy"
				element={<App CustomComponent={PrivacyPolicy} />}
			/>

			<Route
				path="/ToS"
				element={<App CustomComponent={ToS} />}
			/>

			<Route
				path="/Game"
				element={
					<ProtectedRoute>
						<App CustomComponent={PhaserGame} />
					</ProtectedRoute>
				}
			/>

			<Route
				path="/GameDebug"
					element={<App CustomComponent={PhaserGame} />}
			/>

		</Routes>
	)
}
