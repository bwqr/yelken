# Yelken

> [!NOTE]
> Yelken is in its early stages where most of its functionalities are not implemented, it has missing documentation and lacks necessary guidance. Organization of this repository is a little bit clumsy at the moment.

Yelken is a Content Management System (CMS) that aims to be secure by design, extendable with plugins while staying speedy.
It utilizes Rust programming language and libraries developed around it to achieve its goals.
Literary, Yelken is a Turkish noun that means **sail** in English.

The main goals of Yelken can be described as
* Stay secure against plugins and malicious user requests
* Require very low compute resources and be very fast
* Have an extendable architecture with plugins and themes
* Keep deployment to anywhere very easy

Yelken also received its first alpha release. You can read more about this release from [announcement](https://blog.yelken.io/first-announcement/), if you have not read it yet.

## Features

* [x] Content management with built in localization support (define your own model to have different kind of contents)
* [x] Admin UI (called App)
* [x] Templating to manage look of your website (based on Jinja2, enables theming your website)
* [ ] Receiving input from users (form handling)
* [ ] Powerful plugin system (supports plugins written in other programming languages thanks to WebAssembly, e.g., Rust, C, Go, Javascript, Python, etc.)
  * Implemented as a PoC, needs required capabilities of plugins to be identified
* [ ] Observability (exposes various metrics as time series data)
* [ ] Permission System (for users and also plugins)

## Documentation

Right now, [Yelken Book](https://docs.yelken.io) is the correct place to look for documentation.

## Getting Started

Yelken Book has a chapter about [Getting Started](https://docs.yelken.io/getting-started.html) which describes how to run Yelken.

## Roadmap

Yelken has an ambitious goal to change the CMS world by providing a software that requires low compute resources and provide many essential features as built in to its core while enabling its extension with a powerful plugin ecosystem.
To achieve its goal, it needs to

* [ ] Complete planned features
* [ ] Have a plugin marketplace
* [ ] Make its deployment to any environment an easy task
* [x] Provide Yelken as SaaS

As a first step, Yelken targets reaching `0.1.0` version that should provide a good base to continue building on. You can check the roadmap of `0.1.0` version from [Yelken 0.1.0](https://github.com/users/bwqr/projects/3/views/1) project.

## Community

You can express your ideas and questions in Issues or Discussions.
You can also join our [Discord](https://discord.gg/D4bfHr8neh) server to chat about Yelken.

## Contributing

Contributions are welcome to Yelken. There is no contribution guideline at the moment but it should land in the near future.

## Security

Yelken prioritizes Security among other items in its list.
A Yelken instance should sustain its defined functionality without disclosing any private information to public, such as having a remote code execution caused by an unauthorized user.
Since Yelken is in its early stages, feel free to open an issue or discussion if you have a security concern.

## License

Yelken employs [Business Source License 1.1](LICENSE) to sustain its development.
In summary, any individual can freely use Yelken or provide support for setting up Yelken on production.
However, Yelken cannot be used for providing Software as a Service (SaaS) unless a license is granted.
