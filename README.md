# JAMBO 🌍

[![ixo.world](https://img.shields.io/badge/ixo-project-blue)](https://ixo.world)
[![GitHub](https://img.shields.io/github/stars/ixofoundation/jambo?style=social)](https://github.com/ixofoundation/jambo)
![GitHub repo size](https://img.shields.io/github/repo-size/ixofoundation/jambo)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/ixofoundation/jambo/blob/main/LICENSE)

[![Twitter](https://img.shields.io/twitter/follow/ixo_impact?style=social)](https://twitter.com/ixoworld)
[![Medium](https://img.shields.io/badge/Medium-ixo-green)](https://medium.com/ixo-blog)

<p align="center">
  <img  src="assets/images/docs/jambo_github_header.png"/>
</p>

This repo and product is intentionally managed as Open Source and we aim to use this guide to light our way https://opensource.guide/.  
Let us know how we are doing!

---

## 🚀 How to create a dApp using this repo

JAMBO is a web application based on NEXT.js for building decentralized applications (dApps) on the ixo network or any other cosmos chain. This documentation will guide you through the process of creating your own dApp using JAMBO by forking the repository, configuring your dApp, adding environment variables, testing, and deploying your dApp.

### 1 Fork the repo

To get started, fork the [JAMBO](https://github.com/ixofoundation/jambo) repository on Github by navigating to the repository page and clicking the `Fork` button in the upper right-hand corner. Once you've done this, clone the repository onto your computer and follow the next steps locally.

### 2 Configure the dApp

In your newly forked JAMBO repository, you'll need to configure your dApp by updating the configuration file, uploading custom images, and setting up your own theme.

To configure your dApp, go to the `constants` folder and open the `config.json` file. Here, you can update the necessary fields to reflect your desired configurations. For an overview of each property in the `config.json` file, refer to the [config.json](#📄-configjson) section below.

Next, upload your custom images into the `public/images` folder. These images include your logo, social image, and action images. You can also customize the fallback images and wallet images if you wish.

To set up your custom theme, navigate to the `styles` folder and open the `variables.scss` file. In this file, update the CSS styles as needed.

After configuring the dApp, it's time to save your changes and push them to the repository.

### 3 Add environment variables

Before deploying your dApp, you'll need to add the necessary environment variables. This will allow the dApp to use different or multiple chains or chain networks thanks to the [cosmos chain resolver](https://www.npmjs.com/package/@ixo/cosmos-chain-resolver). To achieve this, you can either duplicate the example file `.env.example` in the root of the project and rename it to `.env` or create a new `.env` file in the root of the project and configure the environment variables below:

- `NEXT_PUBLIC_CHAIN_NAMES`: A comma-separated list of names of any Cosmos chain as found in the [Cosmos chain registry](https://github.com/cosmos/chain-registry). The purpose of this variable is to specify which Cosmos chains the dApp should support.
- `NEXT_PUBLIC_ENABLE_DEVELOPER_MODE`: Set this variable to true to allow the dApp to support testing on testnets. Otherwise, it can be ignored and the dApp will only support mainnet.
- `NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK`: Specify the preferred network for the initial load of the dApp if developer mode is active (defaults to devnet). Otherwise, it can be ignored.

![.env example](/assets/images/docs/env_example.png)

Once you've added these variables, you can start a local instance of your dApp with the following terminal command:

```js
npm run dev
// or
yarn dev
```

After the local instance has started up, you can test your dApp at localhost:3000. If the server fails to start up, ensure that you have the necessary packages installed by running `yarn` or `npm install` in your terminal. Don't forget to restart your local instance after updating any environment variables.

### 4 Deploy your dApp

Once you're satisfied with your dApp, you can proceed with the deployment process. These docs only cover deployment to [Netlify](https://www.netlify.com/), but you can also deploy it via any hosting platform that supports Next.js projects.

To deploy your dApp on Netlify, follow these steps:

1. On your Netlify dashboard, click on the `New site from Git` button on the Sites panel.
2. Select the Git provider where your forked repository is located (e.g., GitHub) and choose the forked repository from the list.
3. Configure the deploy settings, including the branch to deploy, build command, and publish directory. Netlify will detect and auto-populate these settings for you if you're not sure what to do.
4. Click on the `Deploy site` button to start the deployment process.

Note that the initial deployment will not work without adding your environment variables from [step 3](#3-add-environment-variables) to your Netlify settings. To do this, navigate to your dApp's `Site Settings` page on Netlify and click on the `Environment Variables` section. There you can add (or edit) your dApp's environment variables as needed.

Once you've added the necessary environment variables, you'll need to redeploy the dApp to reflect the changes. You can do this by clicking on the `Trigger deploy` button on the `Deploys` panel of your Netlify dashboard.

If you encounter any issues during the deployment process, feel free to consult the [Netlify](https://www.netlify.com/) documentation or reach out to the JAMBO community for support.

🎉 🎉 🎉 That's it!

By following these steps, you should be able to successfully create your own dApp from JAMBO. If you encounter any issues during the deployment process, consult the documentation of your hosting platform for further instructions.

---

## 📄 Config.json

The config.json file allows you to configure various aspects of your dApp, including its name, description, metadata and actions. Here's an overview of the available configuration options:

- `siteName`: The name of your dApp.
- `siteUrl`: The URL of your dApp.
- `siteTitleMeta`: The title of your dApp that will appear in the browser's tab.
- `siteDescriptionMeta`: The description of your site that will appear in search engine results.
- `fontUrl`: The URL for the Google Fonts. Leave this property as-is, unless you have a specific font you'd like to use.
- `fontName`: The name of the Google Font used for the site. Leave this property as-is, unless you imported a font via `fontUrl`.
- `headerShowName`: Whether or not to display the site name in the header.
- `headerShowLogo`: Whether or not to display the site logo in the header.
- `about`: Information about your site displayed on the about page. This can be a string of HTML or plain text or a link to an external site.
- `termsAndConditions`: The terms and conditions for the usage of your dApp on the terms page. This can be a string of HTML or plain text or a link to an external site.
- `actions`: An array of actions to be used in the dApp. Actions are the main functionality of the dApp and can consist of one or more steps. Each step corresponds to a screen being displayed to the user, where the user can input some sort of data required for the action. Conventionally, the final step is the "review and sign" screen, which allows the user to review the data they have entered and sign the transaction for the action they are performing.

Each action object has the following properties:

- `id`: A unique identifier for the action (used for routing).
- `name`: The name of the action.
- `description`: A short description of what the action does
- `image`: An image associated with the action (stored in /public/images/actions).
- `steps`: An array of steps that make up the action. Each step has an id (from a list of predefined ids which corresponds to a specific screen to display), and a name for the step.

The steps available for actions can be seen in the [steps](#📚-steps) section.

Below is an example configuration for a delegate action, which allows the user to stake tokens to validators. The id property is a unique identifier for the action and is used for navigation and routing, while the image property represents an image associated with the action (hence the image name corresponds with the action's id).

![config.json example](/assets/images/docs/config_json_example.png)

---

## 📚 STEPS

| Send                                                                  |                                                                             |                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| get_receiver_address                                                  | select_token_and_amount                                                     | bank_MsgSend                                          |
| ![get_receiver_address](/assets/images/docs/get_receiver_address.png) | ![select_token_and_amount](/assets/images/docs/select_token_and_amount.png) | ![bank_MsgSend](/assets/images/docs/bank_MsgSend.png) |

| MultiSend                                                             |                                                                             |                                                                 |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| get_receiver_address                                                  | select_token_and_amount                                                     | bank_MsgMultiSend                                               |
| ![get_receiver_address](/assets/images/docs/get_receiver_address.png) | ![select_token_and_amount](/assets/images/docs/select_token_and_amount.png) | ![bank_MsgMultiSend](/assets/images/docs/bank_MsgMultiSend.png) |

| Delegate                                                                  |                                                                           |                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| get_validator_delegate                                                    | select_amount_delegate                                                    | staking_MsgDelegate                                                 |
| ![get_validator_delegate](/assets/images/docs/get_validator_delegate.png) | ![select_amount_delegate](/assets/images/docs/select_amount_delegate.png) | ![staking_MsgDelegate](/assets/images/docs/staking_MsgDelegate.png) |

| Undelegate                                                                                        |                                                                               |                                                                         |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| get_delegated_validator_undelegate                                                                | select_amount_undelegate                                                      | staking_MsgUndelegate                                                   |
| ![get_delegated_validator_undelegate](/assets/images/docs/get_delegated_validator_undelegate.png) | ![select_amount_undelegate](/assets/images/docs/select_amount_undelegate.png) | ![staking_MsgUndelegate](/assets/images/docs/staking_MsgUndelegate.png) |

| Redelegate                                                                                        |                                                                               |                                                                               |                                                                         |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| get_delegated_validator_redelegate                                                                | select_amount_redelegate                                                      | get_validator_redelegate                                                      | staking_MsgRedelegate                                                   |
| ![get_delegated_validator_redelegate](/assets/images/docs/get_delegated_validator_redelegate.png) | ![select_amount_redelegate](/assets/images/docs/select_amount_redelegate.png) | ![get_validator_redelegate](/assets/images/docs/get_validator_redelegate.png) | ![staking_MsgRedelegate](/assets/images/docs/staking_MsgRedelegate.png) |

| Claim Rewards                                                                                               |     |     |
| ----------------------------------------------------------------------------------------------------------- | --- | --- |
| distribution_MsgWithdrawDelegatorReward                                                                     |     |     |
| ![distribution_MsgWithdrawDelegatorReward](/assets/images/docs/distribution_MsgWithdrawDelegatorReward.png) |     |     |

---

## 💼 Wallets

The JAMBO client makes use of the following wallets:

- **Keplr**: This is a browser extension wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has a number of features including support for multiple chains, staking, governance voting, and more. Docs available [here](https://docs.keplr.app/api/).
- **Opera Wallet**: This is a mobile wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has features such as a built-in browser, QR code scanner, and support for multiple chains. Docs available [here](https://www.npmjs.com/package/@ixo/jambo-wallet-sdk) and [here](https://help.opera.com/en/crypto/opera-wallet-integration-guide/).
- **WalletConnect**: This is a protocol for connecting decentralized applications to mobile wallets with QR code scanning. It is currently being implemented and will soon be available for use with any JAMBO dApp.

---

## 🌟 How to contribute to this repo

First off, thank you for applying your mind and time to improving this repo - it helps the Internet of Impact to save our planet!  
Whether you are contributing in your own space-time or following a bounty; we are grateful!

1. Fork the repo or submodule.
2. Ensure that you sync the fork often.
3. Clone your fork and create a branch that conforms to Github naming conventions.
4. Implement your changes one at a time and commit regularly to your fork.
5. Once your change is completed and passes all of the local tests, create a PR.
6. Your change will be reviewed as soon as possible with helpful feedback for your further updates to the change.
7. Finally, when everything is good to go and your PR approved, you can squash and merge your branch.

### 🤔 How does it work?

If you want to contribute to the project but aren't sure what to do or how it works, read our [Developer Documentation](/DEVELOPER.md).

## 💻 Next + Netlify + TypeScript

This is a [Next.js](https://nextjs.org/) project set up to be instantly deployed to [Netlify](https://netlify.com).

Deployment on Netlify can be [configured](https://docs.netlify.com/configure-builds/file-based-configuration/) using `netlify.toml`.

### Installation options

**Option one:** One-click deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/EarthProgram/Earthport)

1. Click this button, follow the Netlify prompts to allow access to your GitHub account, and allow it to create a clone of this repository on your account.
2. Clone the new repository in your GitHub account

**Option two:** Manual clone

1. Clone this repo: `git clone https://github.com/ixofoundation/jambo.git`
2. Navigate to the directory and run `npm run dev`
3. Make your changes
4. Connect to [Netlify](https://netlify.com) manually (the `netlify.toml` file is the one you'll need to make sure stays intact to make sure the export is done and pointed to the right stuff)

### Getting Started Locally

1. Install dependencies

```bash
npm install
# or
yarn
```

2. Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application and see changes in your browser by editing `pages/index.tsx`.
