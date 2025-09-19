<p align="center"><img src="https://raw.githubusercontent.com/MercuryWorkshop/scramjet/main/assets/scramjet.png" height="200"></p>

<h1 align="center">Scramjet Demo</h1>

The demo implementation of Scramjet, the most advanced web proxy.

Scramjet is an experimental interception based web proxy designed with security, developer friendliness, and performance in mind. This project is made to evade internet censorship and bypass arbitrary web browser restrictions.

## Setup / Usage

Install dependencies

```
pnpm install
```

Run the server

```
pnpm start
```

### HTTP Transport

The example uses [EpoxyTransport](https://github.com/MercuryWorkshop/EpoxyTransport) to fetch proxied data encrypted.

You may also want to use [CurlTransport](https://github.com/MercuryWorkshop/CurlTransport), a different way of fetching encrypted data.

This example also now uses [wisp-js/server](https://www.npmjs.com/package/@mercuryworkshop/wisp-js) instead of the now outdated wisp-server-node. Please note that this can also be replaced with other wisp implementations like [wisp-server-python](https://github.com/MercuryWorkshop/wisp-server-python) which is highly recommend for production.

See the [bare-mux](https://github.com/MercuryWorkshop/bare-mux) documentation for more information.
