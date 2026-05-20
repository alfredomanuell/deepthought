import { useEffect, useState, PropsWithChildren } from 'react'
import ReactMarkdown from 'react-markdown'

function ScrollableCard({ children }: PropsWithChildren) {
	return (
		<div className="text-contrast font-sans w-2/3 h-full bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black overflow-auto p-6">
			{children}
		</div>
	)
}

export default function ToS() {
	const [content, setContent] = useState('')

	const mdComponents: Record<string, any> = {
		p: ({ node, ...props }: any) => (
			<p className="text-sm leading-relaxed mb-4 text-contrast" {...props} />
		),
		h1: ({ node, ...props }: any) => (
			<h1 className="text-2xl font-bold mb-4" {...props} />
		),
		h2: ({ node, ...props }: any) => (
			<h2 className="text-xl font-semibold mb-3" {...props} />
		),
		h3: ({ node, ...props }: any) => (
			<h3 className="text-lg font-semibold mb-2" {...props} />
		),
		a: ({ node, ...props }: any) => (
			<a className="text-blue-500 underline" {...props} />
		),
		li: ({ node, ...props }: any) => (
			<li className="ml-6 list-disc mb-2" {...props} />
		),
		code: ({ inline, className, children, ...props }: any) =>
			inline ? (
				<code className="bg-neutral/20 px-1 rounded text-sm" {...props}>
					{children}
				</code>
			) : (
				<pre className="bg-neutral p-4 rounded overflow-auto">
					<code {...props}>{children}</code>
				</pre>
			),
		blockquote: ({ node, ...props }: any) => (
			<blockquote className="border-l-4 pl-4 italic text-neutral-600" {...props} />
		),
	}

	useEffect(() => {
		// public assets should be requested from the root
		fetch('/ToS.md')
			.then(response => response.text())
			.then(text => setContent(text))
			.catch(error => console.error('Error fetching ToS:', error))
	}, [])

	return (
		<ScrollableCard>
			<ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
		</ScrollableCard>
	)
}