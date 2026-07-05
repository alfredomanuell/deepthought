import { Route, Routes } from "react-router-dom";

import App from "../App";

import SignIn from "../signin/signin";
import OTPEmail from "../signin/OTPemail";

import PhaserGame from "../components/PhaserGame";
import ProfileSetup from "../pages/ProfileSetup";
import CharacterCreation from "../pages/CharacterCreation";
import AdminPanel from "../pages/AdminPanel";

import PrivacyPolicy from "../policy_pages/PrivacyPolicy";
import ToS from "../policy_pages/ToS";
import Feedback from "../pages/Feedback";

import ProtectedRoute from '../components/ProtectedRoute'

export function AppRouter() {

	return (

		<Routes>

			<Route
				path="/"
				element={<App CustomComponent={SignIn} />}
			/>

			<Route
				path="/OTPEmail"
				element={<App CustomComponent={OTPEmail} />}
			/>

			<Route
				path="/Feedback"
				element={<App CustomComponent={Feedback} />}
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
				path="/ProfileSetup"
				element={
					<ProtectedRoute>
						<App CustomComponent={ProfileSetup} />
					</ProtectedRoute>
				}
			/>

			<Route
				path="/CharacterCreation"
				element={
					<ProtectedRoute>
						<App CustomComponent={CharacterCreation} />
					</ProtectedRoute>
				}
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
				path="/Admin"
				element={
					<ProtectedRoute>
						<App CustomComponent={AdminPanel} />
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
