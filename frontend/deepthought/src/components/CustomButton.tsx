import { useNavigate } from "react-router-dom"

export default function CustomButton({name, route} : {name : string, route : string}){
	const navigate = useNavigate();
	return (
		<button onClick={() => navigate(route)} className="text-neutral_contrast block mt-4 mx-auto font-pressStart text-[14px] 
			bg-contrast border-black border-t-4 border-l-4 border-b-8 border-r-8 hover:border-t-4 hover:border-l-4 hover:border-b-4 hover:border-r-4
			hover:translate-x-1 hover:translate-y-1
			transition-all duration-100 hover:bg-secundary
			py-4 px-10">
				{name}
		</button>
	)
}