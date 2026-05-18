
export default function App({CustomComponent} : {CustomComponent : any}) {
	console.log(CustomComponent)
	return (
		<>
			<div className="bg-background h-screen">
				<div className='h-screen flex items-center justify-center '>
					<CustomComponent/>
				</div>
			</div>
		</>
	)
}
