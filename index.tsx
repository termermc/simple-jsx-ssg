/**
 * Simple, programmatic SSG using JSX (or TSX) for [Bun](https://bun.sh/).
 *
 * See the project's [repository](https://git.termer.net/termer/simple-jsx-ssg) ([GitHub](https://github.com/termermc/simple-jsx-ssg)) for more info.
 *
 * @module
 */

import { renderToReadableStream } from 'react-dom/server'
import { JSX } from 'react'
import { join as joinPaths } from 'path'
import { mkdir, readdir, rm, stat } from 'fs/promises'
import { Stats } from 'fs'
import { exists } from 'fs/promises'
import { basename, dirname } from 'path/posix'

const streamDecoder = new TextDecoder('utf-8')

/**
 * Renders a JSX element to a UTF-8 HTML string
 * @param element The element to render
 * @returns The resulting UTF-8 HTML string
 */
export async function renderToString(element: JSX.Element): Promise<string> {
	let res = ''

	for await (const part of await renderToReadableStream(element)) {
		res += streamDecoder.decode(part)
	}

	return res
}

/**
 * Copies a directory recursively.
 * The contents of the source file or directory will be copied into the target directory.
 *
 * For example, if source is './files' with 'a.png', 'b.png' and 'c.png' in it, and target is './target', then the following will be true:
 *  - All files in './files' will be copied into './target'
 *  - './target' will now contain 'a.png', 'b.png' and 'c.png'
 *  - './files' will not contain a directory named 'source', only the files within './source'
 *  - './source' will remain unchanged
 *
 * @param source The source directory
 * @param target The target directory
 */
export async function copyRecursive(source: string, target: string): Promise<void> {
	// Stat to check if it's a directory
	if (!(await stat(source)).isDirectory()) {
		// If it's not a directory, just copy it
		await Bun.write(target, Bun.file(source))
		return
	}

	// Since the path is a directory, stat target to make sure the function can do what it needs to
	let targetStat: Stats | null = null
	let madeDir = false
	try {
		targetStat = await stat(target)
	} catch (err) {
		// If not found, just create it
		if ((err as any).code === 'ENOENT') {
			await mkdir(target, { recursive: true })
			madeDir = true
		} else {
			throw err
		}
	}

	if (!madeDir && !(targetStat as Stats).isDirectory()) {
		throw new Error(`Cannot copy from source ${source} to non-directory target ${target}`)
	}

	const paths = ['']

	// Loop util there are no more paths to crawl
	while (paths.length > 0) {
		const path = paths.shift() as string

		// List children
		const files = await readdir(joinPaths(source, path))
		for (const file of files) {
			const childPath = joinPaths(path, file)
			const realPath = joinPaths(source, childPath)

			// Check if path is a directory, adding to paths list if it is, otherwise copying the file
			const targetPath = joinPaths(target, childPath)
			if ((await stat(realPath)).isDirectory()) {
				await mkdir(targetPath)
				paths.push(childPath)
			} else {
				await Bun.write(targetPath, Bun.file(realPath))
			}
		}
	}
}

/**
 * Class that represents parsed command line arguments.
 * It supports normal arguments and `--` option arguments.
 * Options are parsed into a map, where the key is the name, and the value is either the value after `=`, or null.
 */
export class ParsedArgs {
	/**
	 * Parses a string array into a {@link ParsedArgs} object.
	 * If sliceFirstTwo is true, then the first two arguments will be sliced off when processing (should be used when passing raw `process.argv`, defaults to true).
	 * @param rawArgs The raw arguments to parse
	 * @param sliceFirstTwo Whether to slice the first two arguments (defaults to true)
	 * @returns The resulting {@link ParsedArgs} object
	 */
	public static parse(rawArgs: string[], sliceFirstTwo = true): ParsedArgs {
		const args = sliceFirstTwo ? rawArgs.slice(2) : rawArgs

		const argsRes: string[] = []
		const optionsRes = new Map<string, string | null>()

		for (const arg of args) {
			if (arg.startsWith('--')) {
				const eqIdx = arg.indexOf('=')
				let key: string
				let value: string | null
				if (eqIdx === -1) {
					key = arg.substring(2)
					value = null
				} else {
					key = arg.substring(2, eqIdx)
					value = arg.substring(eqIdx + 1)
				}

				optionsRes.set(key, value)
			} else {
				argsRes.push(arg)
			}
		}

		return new ParsedArgs(argsRes, optionsRes)
	}

	/**
	 * The parsed options.
	 * Options begin with `--` and optionally have a value specified after `=`.
	 * If there is no value, then it will be null.
	 *
	 * When using the {@link getOption} method on this, the return value will be `undefined` if the option is not specified.
	 * With this in mind, make sure not to confuse a `null` value (option is specified with no value) with `undefined` (option is not specified at all).
	 *
	 * Example options: `--host=0.0.0.0`, `--enable-feature`
	 */
	public readonly options: Map<string, string | null>

	/**
	 * The normal, non-option arguments
	 */
	public readonly args: string[]

	/**
	 * Returns the value of an option.
	 * If it has no value, it will return `null`.
	 * If the option is not specified at all, it will return `undefined`.
	 *
	 * @param arg The name of the option
	 * @returns The value of the option
	 */
	public getOption(arg: string): string | null | undefined {
		return this.options.get(arg)
	}

	/**
	 * Same as {@link getOption}, except it returns a default value if the option is not specified or has no value
	 * @param arg The name of the option
	 * @param defaultVal The default value to return if the option is not specified or has no value
	 * @returns The value of the option, or the default value
	 */
	public getOptionOr<T>(arg: string, defaultVal: T): string | T {
		return this.getOption(arg) ?? defaultVal
	}

	/**
	 * Returns the integer value of an option.
	 * If it has no value or could not be parsed, it will return `null`.
	 * If the option is not specified at all, it will return `undefined`.
	 *
	 * @param arg The name of the option
	 * @param radix The radix to use when parsing (defaults to 10)
	 * @returns The integer value of the option
	 */
	public getOptionInt<T = undefined>(arg: string, radix = 10): number | null | undefined {
		const val = this.options.get(arg)
		if (val == null) {
			return val
		} else {
			return parseInt(val, radix)
		}
	}

	/**
	 * Same as {@link getOptionInt}, except it returns a default value if the option is not specified or has no value
	 * @param arg The name of the option
	 * @param defaultValue The default value to return if the option is not specified or has no value
	 * @param radix The radix to use when parsing (defaults to 10)
	 * @returns The integer value of the option
	 */
	public getOptionIntOr<T>(arg: string, defaultValue: T, radix = 10): number | T {
		const val = this.options.get(arg)
		if (val == null) {
			return defaultValue as T
		} else {
			return parseInt(val, radix)
		}
	}

	/**
	 * Returns the float value of an option.
	 * If it has no value or could not be parsed, it will return `null`.
	 * If the option is not specified at all, it will return `undefined`.
	 *
	 * @param arg The name of the option
	 * @returns The float value of the option
	 */
	public getOptionFloat(arg: string): number | null | undefined {
		const val = this.options.get(arg)
		if (val == null) {
			return val
		} else {
			return parseFloat(val)
		}
	}

	/**
	 * Same as {@link getOptionFloat}, except it returns a default value if the option is not specified or has no value
	 * @param arg The name of the option
	 * @param defaultValue The default value to return if the option is not specified or has no value
	 * @returns The float value of the option
	 */
	public getOptionFloatOr<T>(arg: string, defaultValue: T): number | null | T {
		const val = this.options.get(arg)
		if (val == null) {
			return defaultValue as T
		} else {
			return parseFloat(val)
		}
	}

	/**
	 * Returns whether an option can be considered to be `true`.
	 * If it is not specified at all, it will always be considered `false`.
	 *
	 * By default:
	 *  - An option specified without a value is considered true
	 *  - An option whose value is `"true"`, `"yes"`, `"y"` or `"1"` is considered `true`
	 *  - Option values are case-insensitive
	 *
	 * The above conditions can be changed by passing different arguments to this method.
	 *
	 * @param arg The name of the option to evaluate
	 * @param useNoValueAsTrue Whether to consider an option that was passed without a value as `true`
	 * @param trueValues The list of strings that can be considered to be `true`
	 * @param trueValuesCaseSensitive Whether to compare `trueValues` case-sensitively
	 */
	public isOptionTrue(
		arg: string,
		useNoValueAsTrue = true,
		trueValues = ['true', 'yes', 'y', '1'],
		trueValuesCaseSensitive = false,
	): boolean {
		const val = this.options.get(arg)
		if (val === undefined) {
			return false
		} else if (val === null) {
			return useNoValueAsTrue
		} else {
			if (trueValuesCaseSensitive) {
				return trueValues.includes(val)
			} else {
				const valLower = val.toLowerCase()
				for (const trueVal of trueValues) {
					if (valLower === trueVal.toLowerCase())
						return true
				}
				return false
			}
		}
	}

	constructor(args: string[], options: Map<string, string | null>) {
		this.options = options
		this.args = args
	}
}

/**
 * Returns whether the given object is in the shape of JSX.Element
 * @param obj The object to check
 * @returns Whether the given object is in the shape of JSX.Element
 */
export function isObjectJsxElement(obj: any): obj is JSX.Element {
	return typeof obj === 'object' &&
		'type' in obj as any &&
		'props' in obj as any &&
		'key' in obj
}

/**
 * Creates a {@link Renderer} for a module that returns a {@link Renderer} or {@link RenderResult} value.
 * The {@link Renderer} that this function returns will dynamically import the module when it is called.
 * This function will ensure that the module is reloaded with Bun's hot reload feature.
 *
 * @param modulePath The module's path, as you would specify it for {@link import()} or {@link require()}
 * @returns The resulting {@link Renderer}
 */
export function moduleRenderer(modulePath: string): Renderer {
	return async function (): Promise<RenderResult> {
		const def = (await import(modulePath)).default
		if (typeof def === 'function')
			return await def()
		else
			return def.default
	}
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

/**
 * The main site class generator class.
 * To use it, instantiate it and then use the {@link setRoute} and {@link mapStatic} methods to set routes and static file mappings.
 *
 * To render the site to a directory, use the {@link build} method.
 * To serve the site live, use the {@link serve} method.
 *
 * To act as a CLI, use the {@link cli} method.
 */
export class SiteGenerator {
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
	 * The filename to use for index files (defaults to 'index.html').
	 * You may also use {@link setIndexFilename} fluently.
	 */
	public indexFilename = 'index.html'

	/**
	 * The filename to use for the not found page (defaults to '404.html')
	 * You may also use {@link setNotFoundFilename} fluently.
	 */
	public notFoundFilename = '404.html'

	constructor() {}

	/**
	 * Processes a {@link RenderResult} into a {@link ResponseBody}
	 * @param renderResult The {@link RenderResult} to process
	 * @returns  The resulting {@link ResponseBody}
	 */
	private async toResponseBody(
		renderResult: RenderResult,
	): Promise<ResponseBody> {
		// Based on object signature, determine whether this is a JSX.Element object
		if (isObjectJsxElement(renderResult)) {
			return await renderToReadableStream(renderResult)
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
		if (path.endsWith('/' + this.indexFilename)) {
			routes.push(path.substring(0, path.length - this.indexFilename.length))
		}

		// Try to find a matching route
		let renderer: Renderer | undefined
		for (let route of routes) {
			renderer = this.routes.get(route)

			if (renderer !== undefined) {
				break
			}
		}

		if (renderer === undefined) {
			// No matching route was found, so try to serve a static file if possible, then the 404 route if nothing matches

			for (const [route, staticDir] of this.staticMappings) {
				if (path.startsWith(route)) {
					// Basic path sanitization
					let dirPath = path.substring(route.length)
					if (!dirPath.startsWith('/')) {
						dirPath = '/' + dirPath
					}
					dirPath = dirPath.replace(/\/\.{2,}/g, '')

					const filePath = joinPaths(staticDir, dirPath)

					try {
						const fileInfo = await stat(filePath)

						if (!fileInfo.isFile()) {
							continue
						}

						return new Response(Bun.file(filePath))
					} catch (err) {
						if ('code' in (err as any) && (err as any).code === 'ENOENT') {
							// File not found
						} else {
							throw err
						}
					}
				}
			}

			// If it didn't return by now, then no static file was found

			const options = {
				status: 404,
			}

			const notFoundRenderer = this.routes.get('/' + this.notFoundFilename)
			if (notFoundRenderer === undefined) {
				return new Response(
					'No route was found, and no 404 page was found either',
					options,
				)
			} else {
				return new Response(
					await this.toResponseBody(await notFoundRenderer()),
					options,
				)
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
	 * Sets the filename to use for the not found (404) page
	 * @param filename The filename to use for the not found page
	 * @returns This, to be used fluently
	 */
	public setNotFoundFilename(filename: string) {
		this.notFoundFilename = filename

		return this
	}

	/**
	 * Sets a renderer for a route.
	 * If the route ends with a trailing slash, {@link indexFilename} will be appended to it internally at build/serve time.
	 *
	 * If you want your {@link Renderer} to be hot reloaded with Bun's hot reload feature, specify a module path, or use {@link moduleRenderer}.
	 * Hot reload will not work when providing a {@link Renderer} directly.
	 *
	 * @param route The route
	 * @param renderer The {@link Renderer} for the route, or a path to the module that exports a {@link Renderer} or {@link RenderResult}
	 * @returns This, to be used fluently
	 */
	public setRoute(route: string, renderer: Renderer | string) {
		if (typeof renderer === 'string') {
			this.routes.set(route, moduleRenderer(renderer))
		} else {
			this.routes.set(route, renderer)
		}

		return this
	}

	/**
	 * Maps a route to a static resource directory
	 * @param route The route where the resources will be served from
	 * @param directory The directory that will be the source of the static files
	 * @returns This, to be used fluently
	 */
	public mapStatic(route: string, directory: string) {
		if (!route.startsWith('/')) {
			throw new Error(
				'Static routes must begin with an initial slash (using "/ is valid for root)',
			)
		}
		if (!route.endsWith('/')) {
			throw new Error(
				'Static routes must end with a trailing slash (using "/" is valid for root)',
			)
		}

		this.staticMappings.set(route, directory)

		return this
	}

	/**
	 * Sets a renderer for the not found (404) page
	 *
	 * If you want your {@link Renderer} to be hot reloaded with Bun's hot reload feature, specify a module path, or use {@link moduleRenderer}.
	 * Hot reload will not work when providing a {@link Renderer} directly.
	 *
	 * @param renderer The {@link Renderer} for the route, or a path to the module that exports a {@link Renderer} or {@link RenderResult}
	 * @returns This, to be used fluently
	 */
	public setNotFound(renderer: Renderer | string) {
		const route = '/' + this.notFoundFilename

		if (typeof renderer === 'string') {
			this.routes.set(route, moduleRenderer(renderer))
		} else {
			this.routes.set(route, renderer)
		}

		return this
	}

	/**
	 * Builds the site, rendering it in the specified directory
	 * @param outDir The directory to render the site in
	 * @param clearOutDir Whether to delete the contents of the output directory before building
	 */
	public async build(outDir: string, clearOutDir: boolean): Promise<void> {
		const outDirExists = await exists(outDir)

		if (outDirExists) {
			if (clearOutDir) {
				for (const file of await readdir(outDir)) {
					await rm(joinPaths(outDir, file), { recursive: true, force: true })
				}
			}
		} else {
			await mkdir(outDir, { recursive: true })
		}

		// Copy static files first so that routes will overwrite files if they have the same name
		for (const [route, staticDir] of this.staticMappings) {
			const copyDir = joinPaths(outDir, route)
			console.log(`Mapping ${staticDir} to ${route}...`)
			await copyRecursive(staticDir, copyDir)
		}

		for (const [route, renderer] of this.routes) {
			const render = await renderer()

			let res: string | Uint8Array
			if (typeof render === 'string') {
				res = render
			} else if (isObjectJsxElement(render)) {
				res = await renderToString(render)
			} else if (render instanceof ReadableStream) {
				res = ''
				for await (const chunk of render) {
					res += streamDecoder.decode(chunk)
				}
			} else if (render instanceof Uint8Array) {
				res = render
			} else {
				throw new Error('Invalid render result. Must be one of the following types: string, Uint8Array, ReadableStream, or JSX.Element.')
			}

			let outFile = joinPaths(outDir, route)
			if (outFile.endsWith('/'))
				outFile += this.indexFilename

			console.log(`Rendering ${outFile}...`)
			await mkdir(dirname(outFile), { recursive: true })
			await Bun.write(outFile, res)
		}

		console.log(`Done. Rendered site is available in '${outDir}'.`)
	}

	/**
	 * Starts a webserver on the specified port and optionally hostname that serves the site
	 * @param port The port to run on
	 * @param hostname The hostname to run on (defaults to '127.0.0.1')
	 * @param silent Whether to avoid logging to the console (defaults to false)
	 */
	public serve(
		port: number,
		hostname = '127.0.0.1',
		silent = false,
	): void {
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
	 * Returns the help string for the CLI
	 * @param scriptName The name of the CLI script name or command (defaults to the entrypoint script name)
	 * @returns The help string
	 */
	public getHelpString(scriptName: string = basename(process.argv[1])): string {
		return `
Usage: ${scriptName} <command> [options]

Options:
\tbuild - Builds the site into a directory
\t\t--out=<dir> - The directory to build the site into (defaults to "dist")
\t\t--clear-out=<true|false> - Whether to delete the contents of the output directory before building (defaults to true)

\tserve - Starts a local development webserver for the site
\t\t--host=<host> - The hostname to run on (defaults to "127.0.0.1")
\t\t--port=<port> - The port to run on (defaults to 3000)

\thelp - Prints this message
`.trim()
	}

	/**
	 * Runs the site generator CLI
	 * @param parsedArgs The parsed command line arguments (defaults to parsing process.argv)
	 */
	public async cli(parsedArgs = ParsedArgs.parse(process.argv)): Promise<void> {
		if (parsedArgs.args.includes('build')) {
			const outDir = parsedArgs.getOptionOr('out', 'dist')
			const clearOutDir = parsedArgs.isOptionTrue('clear-out', true)

			await this.build(outDir, clearOutDir)
			process.exit(0)
		} else if (parsedArgs.args.includes('serve')) {
			const host = parsedArgs.getOptionOr('host', '127.0.0.1')
			const port = parsedArgs.getOptionIntOr('port', 3000)

			console.clear()
			console.warn('Warning: This is not a production webserver, it is meant for debugging only.')
			console.warn('Warning: For a production deployment, use the "build" command and place the built files in a directory accessible to your webserver')
			console.warn('Note: You can enable hot code reloading by using Bun\'s "--hot" option.')
			await this.serve(port, host)
		} else {
			console.error(this.getHelpString())
			process.exit(1)
		}
	}
}
