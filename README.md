# simple-jsx-ssg
Simple, programmatic SSG using JSX (or TSX) for [Bun](https://bun.sh/)

# Features
- TypeScript support without a build step
- JSX/TSX support without a build step
- [Development webserver](#development-server) to test changes without building
    - Support for [hot code reloading](#hot-code-reloading)
- Can be embedded in larger applications
- Fully programmatic

# Who Is This For?
This library is for people who like raw HTML and CSS, but also want components and templating.
It has few dependencies (only requires Bun, `react` and `react-dom`), and takes advantage of Bun's TypeScript and JSX capabilities to provide those features without a build step.

Additionally, it is for people who enjoy full control over their experience and are used to router-based web frameworks like [Express.js](https://expressjs.com/).

> This is a library? I thought it was a site generator!

`simple-jsx-ssg` is a library that provides you all the tools you need to build a static site with JSX (or any other technology).

To grant the user greater control, the user needs to import the library.

But don't worry! The CLI functionality is there-- you just have to invoke it.
See the below example for more.

# Simple Example

```tsx
import { SiteGenerator } from 'simple-jsx-ssg'

const ssg = new SiteGenerator()

const renderDate = new Date().toISOString()
const todoList = [
	'Finish the site',
	'Other stuff',
]

// You can create custom components just like in normal JSX
function BasePage(props: { title: string, children: any }) {
	return (
		<html>
		<head>
			<title>{props.title}</title>
		</head>
		<body>
		    <h1>{props.title}</h1>
            <div id="content">{props.children}</div>
		    <hr/>
		    <p>Site rendered at: {renderDate}</p>
		</body>
		</html>
	)
}

// You can map routes to renderer functions,
// and map routes to static directories.
ssg
	.mapStatic('/assets/', './site-assets')
	.setRoute('/', () => (
		<BasePage title="Home">
			<p>Welcome to the homepage.</p>
			<p>Enjoy your stay.</p>
		</BasePage>
	))
	.setRoute('/todo', () => (
		<BasePage title="TODO List">
			<p>TODO:</p>
			<ul>
				{todoList.map((item, index) => (
					<li key={index}>{item}</li>
				))}
			</ul>
		</BasePage>
	))
	.setNotFound(() => (
		<BasePage title="Not Found">
			<p>The page you were looking for could not be found.</p>
		</BasePage>
	))

// Turn this script into a static site builder CLI
await ssg.cli()
```

# Development Server
You can use the CLI (or `SiteGenerator.serve`) to run a development server that will allow you to use your site without building it.
This webserver is not meant for production, and does not expose request data to renderers. **This library is not meant for developing full stack applications**.

## Hot Code Reloading
If you run Bun with the `--hot` option, you can take advantage of hot code reloading while using the development server.

There are some limitations though:
- Hot code reloading isn't guaranteed to reload module imports
- It will not reload markup in your entrypoint script
    - If you want hot code reloading for JSX, provide a path to a module when using `setRoute` and `setNotFound`.
    - You can also use `moduleRenderer`.

If you're having problems with hot reloading, you can also use Bun's `--watch` option to restart the entire process on module changes.
This is less desirable, but it will ensure that everything is updated.

# Limitations
Currently, you cannot use inline event handlers such as `onclick` with JSX.
They will not show up in the rendered output. With that said, you really shouldn't be using inline JavaScript on your pages at all.

# Contribute
You can contribute on the [GitHub repository](https://github.com/termermc/simple-jsx-ssg).

# Support
If you notice a bug or have a question, you can open an issue on the [GitHub repository](https://github.com/termermc/simple-jsx-ssg),
or send a message in [#termer-libraries](https://web.liao.ws/#termer-libraries) on [Liao IRC](https://liao.ws/).

If you're using this library, I assume you know JavaScript.
With that in mind, you can probably answer most of your own questions by reading `index.tsx`, which contains the entire library.
