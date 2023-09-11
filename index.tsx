import { renderToReadableStream } from 'react-dom/server'
import { JSX } from 'react'

function F(): JSX.Element {
	return <h1>hello</h1>
}

const streamDecoder = new TextDecoder('utf-8')

/**
 * Renders a JSX element to a UTF-8 HTML string
 * @param element The element to render
 * @returns The resulting UTF-8 HTML string
 */
export async function renderToString(element: JSX.Element): Promise<string> {
	let res = ''

	for await (let part of await renderToReadableStream(element))
		res += streamDecoder.decode(part)

	return res
}

/**
 * Valid data to be used as a body when constructing a {@link Response} object
 */
type ResponseBody = string | Uint8Array | ReadableStream<Uint8Array>

/**
 * A {@link Renderer}'s result type, data that can be rendered
 */
export type RenderResult = ResponseBody | JSX.Element

/**
 * A function that returns rendered data
 */
export type Renderer = () => RenderResult | Promise<RenderResult>

class SiteGenerator {
	/**
	 * A map of routes and their corresponding renderers.
	 * It's recommended to use {@link setRoute} rather than manipulating this object directly.
	 */
	public readonly routes = new Map<string, Renderer>()

	/**
	 * A map of routes and routes where static resources will be served and the directories from which the static resources will be sourced.
	 * It's recommended to use {@link mapStatic} rather than manipulating this object directory.
	 */
	public readonly staticMappings = new Map<string, string>()

	/**
	 * The filename to use for index files (defaults to "index.html").
	 * You may also use {@link setIndexFilename} fluently.
	 */
	public indexFilename = 'index.html'

	/**
	 * The filename to use for the not found page (defaults to "404.html")
	 * You may also use {@link setNotFoundFilename} fluently.
	 */
	public notFoundFilename = "404.html"

	constructor() {}

	/**
	 * Processes a {@link RenderResult} into a {@link ResponseBody}
	 * @param renderResult The {@link RenderResult} to process
	 * @returns  The resulting {@link ResponseBody}
	 */
	private async toResponseBody(renderResult: RenderResult): Promise<ResponseBody> {
		// Based on object signature, determine whether this is a JSX.Element object
		if (
			typeof renderResult === 'object'
			&& 'type' in (renderResult as any)
			&& 'props' in (renderResult as any)
			&& 'key' in (renderResult as any)
		) {
			return await renderToReadableStream(renderResult as JSX.Element)
		} else {
			return renderResult as ResponseBody
		}
	}

	/**
	 * Webserver request handler
	 * @param req The request
	 * @returns The response
	 */
	private async reqHandler(req: Request): Promise<Response> {
		const path = req.url.substring(req.url.indexOf('/', 8))

		const routes = [
			path,
			path + '/',
		]

		// Try without index suffix
		if (path.endsWith('/' + this.indexFilename))
			routes.push(path.substring(0, path.length - this.indexFilename.length))

		// Try to find a matching route
		let renderer: Renderer | undefined
		for (let route of routes) {
			renderer = this.routes.get(route)

			if (renderer !== undefined)
				break
		}

		if (renderer === undefined) {
			// No matching route was found, so try to serve the 404 route if possible

			const options = {
				status: 404
			}

			const notFoundRenderer = this.routes.get('/' + this.notFoundFilename)
			if (notFoundRenderer === undefined) {
				return new Response('No route was found, and no 404 page was found either', options)
			} else {
				return new Response(await this.toResponseBody(await notFoundRenderer()), options)
			}
		} else {
			// Route was found, render it
			return new Response(await this.toResponseBody(await renderer()))
		}
	}

	/**
	 * Sets the filename to use for index pages
	 * @param filename The filename to use for index pages
	 * @returns This, to be used fluently
	 */
	public setIndexFilename(filename: string) {
		this.indexFilename = filename

		return this
	}

	/**
	 * Sets a renderer for a route.
	 * If the route ends with a trailing slash, {@link indexFilename} will be appended to it internally at build/serve time.
	 * @param route The route
	 * @param renderer The renderer for the route
	 * @returns This, to be used fluently
	 */
	public setRoute(route: string, renderer: Renderer) {
		this.routes.set(route, renderer)

		return this
	}

	/**
	 * Sets a renderer for the not found (404) page
	 * @param renderer The renderer for the not found page
	 * @returns This, to be used fluently
	 */
	public setNotFound(renderer: Renderer) {
		this.routes.set('/' + this.notFoundFilename, renderer)

		return this
	}

	/**
	 * Starts a webserver on the specified port and optionally hostname that serves the site
	 * @param port The port to run on
	 * @param hostname The hostname to run on (defaults to '127.0.0.1')
	 * @param silent Whether to avoid logging to the console (defaults to false)
	 */
	public async serve(port: number, hostname: string = '127.0.0.1', silent: boolean = false): Promise<void> {
		Bun.serve({
			port,
			hostname,
			fetch: this.reqHandler.bind(this),
		})

		if (!silent) {
			console.log(`Listening on ${hostname}:${port}`)
		}
	}

	/**
	 * Runs the generator as a CLI.
	 * TODO Docs on this, basically "build" will build, "serve" will serve, --help will show help, and nothing will also show help
	 */
	public async cli(): Promise<void> {
		const args = process.argv.slice(2)

		if (args.includes('build')) {
			// TODO Accept build arguments, like output dir
			console.log('TODO Build')
			process.exit(0)
		} else if (args.includes('serve')) {
			// TODO Accept serve arguments, like port and host
			console.log('TODO Serve')
			await this.serve(8080)
		} else {
			const scriptName = process.argv[1]
			console.error(`Usage: ${scriptName} <build | serve>`)
			process.exit(1)
		}
	}
}

const generator = new SiteGenerator()

generator
	.setRoute('/', () => <html>
		<head>
			<title>Welcome</title>
		</head>
		<body>
			<h1>Welcome</h1>
			<p>Welcome to the website</p>
		</body>
	</html>)
	.setRoute('/hi/', () => <html>
		<head>
			<title>Hi</title>
		</head>
		<body>
			<h1>Hi</h1>
			<p>Hi</p>
		</body>
	</html>)
	.setNotFound(() => <html>
		<head>
			<title>Not Found</title>
		</head>
		<body>
			<h1>Not Found</h1>
			<p>The page you were looking for could not be found</p>
		</body>
	</html>)

generator.cli()
