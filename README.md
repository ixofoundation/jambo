# JAMBO Client

This repo and product is intentionally managed as Open Source and we aim to use this guide to light our way https://opensource.guide/.  
Let us know how we are doing!

---

## How to create a dApp using this repo

The ixo-jambo-client project is a NEXT-based web application for building dApps on the ixo network (or any other cosmos chain). This documentation will guide you to create your own dApp through the process of forking the repository, updating the config file, deploying changes, adding environment variables, and redeploying the site.

### Fork the repo:

To begin, fork the [ixo-jambo-client](https://github.com/ixofoundation/ixo-jambo-client) repository on Github. You can do this by going to the repository's Github page and clicking the "Fork" button in the upper right-hand corner.

### Update the config file:

After forking the repo, navigate to the "constants" folder in the project's directory and open the "[config.json](#configjson)" file. In this file, update the necessary fields to reflect your desired configurations. After updating the config file, it's time to save and push the changes to your repo.

### Add environment variables:

In order for the changes made in the config file to take effect, you need to add the necessary environment variables.
Depending on your hosting platform, the method for adding environment variables may vary.\
For Netlify, you can add environment variables by going to your site's "Settings" page and clicking on the "Build & deploy" tab, then scrolling down to the "Environment" section and clicking on the "Edit variables" button. \
Add the required environment variables for your configuration changes.

### Redeploy changes:

After adding the necessary environment variables, it's time to deploy the site to reflect the changes made.
Depending on your hosting platform, the deployment process may vary.\
For Netlify, you can deploy the site by pushing changes to the repository's main branch.

### Verify the changes:

After the redeployment process is complete, verify that the changes made in the config file are reflected in the deployed site.
You can test the site by visiting the deployed URL and ensuring that the site functions as expected.
That's it! By following these steps, you should be able to successfully create a dApp from Ixo's JAMBO Client with your desired configurations. If you encounter any issues during the deployment process, consult the documentation of your hosting platform for further instructions.

---

### Config.json

Here's an overview of each of the properties in the config.json file:

- siteName: The name of your site.
  - Update this property with the desired name of your site.
- siteUrl: The URL of your site.
  - Update this property with the URL of your site.
- siteTitleMeta: The title of your site.
  - Update this property with the title of your site that will appear in the browser's tab.
- siteDescriptionMeta: The description of your site.
  - Update this property with the description of your site that will appear in search engine results.
- wcNamespace: The namespace used for ixo-related Web Components.
  - You can leave this property as-is, as WalletConnect features are still in development.
- fontUrl: The URL for the Google Fonts.
  - You can leave this property as-is, unless you have a specific font you'd like to use.
- fontName: The name of the Google Font used for the site.
  - You can leave this property as-is, unless you imported a font via fontUrl.
- headerShowName: Whether or not to display the site name in the header.
  - Update this property with a boolean value (true or false) to indicate whether or not to display the site name in the header.
- headerShowLogo: Whether or not to display the site logo in the header.
  - Update this property with a boolean value (true or false) to indicate whether or not to display the site logo in the header.
- about: Information about your site displayed on the about page.
  - Update this property with information about your site that will be displayed in the "About" section.
  - This can be a string of HTML or plain text or a link to an external site.
- termsAndConditions: Information about your site displayed on the about page.
  - Update this property with the terms and conditions of your dApp that will be displayed in the "Terms and Conditions" section.
  - This can be a string of HTML or plain text or a link to an external site.
- actions: An array of actions to be used in the dApp.
  - This property contains an array of objects that represent the actions you want the dApp to use through a series of steps.
  - Actions are the main functionality of the dApp and can consist of one or more steps. Each step corresponds to a screen being displayed to the user, where the user can input some sort of data required for the action. The final step is the "sign and review" screen, which allows the user to review the data they have entered and sign the transaction for the action they are performing.
  - Some steps have required prerequisites such as the delegate action needs a validator address and amount before the delegate transaction can be generated and signed. There are limited steps available but more are being developed to allow full customization of any dApp developed by the Ixo JAMBO Client.
  - Each action object has the following properties:
    - id: A unique identifier for the action.
    - steps: An array of steps that make up the action. Each step has an:
      - id from a list of predefined ids which corresponds to a specific screen to display (as seen below)
      - name for the step
      - config to configure the step if applicable
    - name: The name of the action.
    - description: A description of what the action does.
    - image: An image associated with the action.
  - The steps available for actions are:
    - `get_receiver_address` that allows a user to provide an address
    - `get_validator_delegate` that allows a user to select a validator
    - `get_validator_redelegate` that allows a user to select a validator
    - `get_delegated_validator_undelegate` that allows a user to select a validator from a list of delegated validators
    - `get_delegated_validator_redelegate` that allows a user to select a validator from a list of delegated validators
    - `select_token_and_amount` that allows a user to select a token and provide an amount
    - `select_amount_delegate` that allows a user to provide an amount
    - `select_amount_undelegate` that allows a user to select a token and provide an amount
    - `select_amount_redelegate` that allows a user to select a token and provide an amount
    - `bank_MsgSend` that generates a send transaction and allows a user to sign
    - `bank_MsgMultiSend` that generates a multi send transaction and allows a user to sign
    - `staking_MsgDelegate` that generates a delegate transaction and allows a user to sign
    - `staking_MsgUndelegate` that generates an undelegate transaction and allows a user to sign
    - `staking_MsgRedelegate` that generates a redelegate transaction and allows a user to sign
    - `distribution_MsgWithdrawDelegatorReward` that generates a claim delegation rewards transaction and allows a user to sign
  - In the example object below, the action is called "Delegate" and has three steps. The first step is "Get validator address", the second is "Define amount to delegate", and the final step is "Review and sign". This particular action allows the user to delegate tokens on the IXO Network. The id property is a unique identifier for the action and it's used for navigation and routing, and the image property represents an image associated with the action (hence the image name corresponds with the action's id).

```json
{
  "siteName": "My dApp",
  "siteUrl": "https://my-dapp.netlify.app",
  "siteTitleMeta": "My dApp - built with ixo-jambo-client",
  "siteDescriptionMeta": "A decentralized application built on the ixo network using ixo-jambo-client.",
  "wcNamespace": "ixo",
  "fontUrl": "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap",
  "fontName": "Roboto",
  "headerShowName": true,
  "headerShowLogo": true,
  "about": "<b>My dApp</b> is a decentralized application built on the ixo network using <i>ixo-jambo-client</i>. Our mission is to provide a platform for users to participate in the creation of impact projects and investments.",
  "termsAndConditions": "https://my-dapp.com/termsAndConditions",
  "actions": [
    {
      "id": "delegate_abc",
      "steps": [
        {
          "id": "get_validator_delegate",
          "name": "Get validator address"
        },
        {
          "id": "select_amount_delegate",
          "name": "Define amount to delegate"
        },
        {
          "id": "staking_MsgDelegate",
          "name": "Review and sign"
        }
      ],
      "name": "Delegate",
      "description": "Delegate tokens on the IXO Network",
      "image": "delegate_abc.png"
    }
  ]
}
```

After updating the desired configurations in the JSON object, save the changes to the "config.json" file. These changes will be reflected in the deployed site after you deploy the changes and add the necessary environment variables.

### .env

If you're not sure on what environment variables to set, then duplicate and use the default values as found in ".env.example". Simply duplicate the file and rename it to ".env". Done.

Else if you want to customize the dApp to use different or even multiple chains or chain networks then follow the steps below:

1. Create a new file named ".env" in the root directory of the project
2. Add the following environment variables to the .env file:
   - NEXT_PUBLIC_CHAIN_NAMES: This variable is a comma-separated list of names of any Cosmos chain as found in the [Cosmos chain registry](https://github.com/cosmos/chain-registry). The purpose of this variable is to specify which Cosmos chains the dApp should support.
   - NEXT_PUBLIC_ENABLE_DEVELOPER_MODE: This variable determines whether the app can use both testnet and mainnet (truthy value) or mainnet only (falsy value). This is false by default.
   - NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK: This variable specifies the preferred network for the initial load of the dApp. If developer mode (NEXT_PUBLIC_ENABLE_DEVELOPER_MODE) isn't active, this variable gets ignored. This variable defaults to devnet if developer mode is active.
3. Here is an example of the .env file with the above variables set (as seen in .env.example):

```.env
NEXT_PUBLIC_CHAIN_NAMES=impacthub,osmosis
NEXT_PUBLIC_ENABLE_DEVELOPER_MODE=1
NEXT_PUBLIC_DEFAULT_CHAIN_NETWORK=mainnet
```

---

## Wallets

The Ixo JAMBO client makes use of the following wallets:

- **Keplr**: This is a browser extension wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has a number of features including support for multiple chains, staking, governance voting, and more. Docs available [here](https://docs.keplr.app/api/).
- **Opera Wallet**: This is a mobile wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has features such as a built-in browser, QR code scanner, and support for multiple chains. Docs available [here](https://help.opera.com/en/crypto/opera-wallet-integration-guide/).
- **WalletConnect**: This is a protocol for connecting decentralized applications to mobile wallets with QR code scanning. It is currently being implemented and will soon be available for use with the dApp.

---

## How to contribute to this repo

First off, thank you for applying your mind and time to improving this repo - it helps the Internet of Impact to save our planet!  
Whether you are contributing in your own space-time or following a bounty; we are grateful!

1. Fork the repo or submodule.
2. Ensure that you sync the fork often.
3. Clone your fork and create a branch that conforms to Github naming conventions.
4. Implement your changes one at a time and commit regularly to your fork.
5. Once your change is completed and passes all of the local tests, create a PR.
6. Your change will be reviewed as soon as possible with helpful feedback for your further updates to the change.
7. Finally, when everything is good to go and your PR approved, you can squash and merge your branch.

### How does it work?

If you want to contribute to the project but aren't sure what to do or how it works, read our [Developer Documentation](/DEVELOPER.md).

## Next + Netlify + TypeScript

This is a [Next.js](https://nextjs.org/) project set up to be instantly deployed to [Netlify](https://netlify.com).

Deployment on Netlify can be [configured](https://docs.netlify.com/configure-builds/file-based-configuration/) using `netlify.toml`.

### Installation options

**Option one:** One-click deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/EarthProgram/Earthport)

1. Click this button, follow the Netlify prompts to allow access to your GitHub account, and allow it to create a clone of this repository on your account.
2. Clone the new repository in your GitHub account

**Option two:** Manual clone

1. Clone this repo: `git clone https://github.com/ixofoundation/ixo-jambo-client.git`
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
