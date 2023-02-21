# Creating a dApp from Ixo's JAMBO Client:

The ixo-jambo-client project is a NEXT-based web application for building dApps on the ixo network (or any other cosmos chain). This documentation will guide you through the process of forking the repository, updating the config file, deploying changes, adding environment variables, and redeploying the site.

## Fork the repo:

To begin, fork the [ixo-jambo-client](https://github.com/ixofoundation/ixo-jambo-client) repository on Github. You can do this by going to the repository's Github page and clicking the "Fork" button in the upper right-hand corner.

## Update the config file:

After forking the repo, navigate to the "constants" folder in the project's directory and open the "[config.json](#configjson)" file. In this file, update the necessary fields to reflect your desired configurations. After updating the config file, it's time to save and deploy the changes.

## Add environment variables:

In order for the changes made in the config file to take effect, you need to add the necessary environment variables.
Depending on your hosting platform, the method for adding environment variables may vary.\
For Netlify, you can add environment variables by going to your site's "Settings" page and clicking on the "Build & deploy" tab, then scrolling down to the "Environment" section and clicking on the "Edit variables" button.
Add the required environment variables for your configuration changes.

## Redeploy changes:

After adding the necessary environment variables, it's time to deploy the site to reflect the changes made.
Depending on your hosting platform, the deployment process may vary.\
For Netlify, you can deploy the site by pushing changes to the repository's main branch.

## Verify the changes:

After the redeployment process is complete, verify that the changes made in the config file are reflected in the deployed site.
You can test the site by visiting the deployed URL and ensuring that the site functions as expected.
That's it! By following these steps, you should be able to successfully create a dApp from Ixo's JAMBO Client with your desired configurations. If you encounter any issues during the deployment process, consult the documentation of your hosting platform for further instructions.

---

## Config.json

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
  - This can be HTML (in a rather long string) or plain text
- actions: An array of actions to be used in the dApp.
  - Update this property with an array of objects that represent the actions you want the dApp to use through a series of steps.
  - Actions are the main functionality of the dApp and can consist of one or more steps. Each step corresponds to a screen being displayed to the user, where the user can input some sort of data required for the action. The final step is the "sign and review" screen, which allows the user to review the data they have entered and sign the transaction for the action they are performing.
  - Some steps have required prerequisites such as the delegate action needs a validator address and amount before the delegate transaction can be generated and signed. There are limited steps available but more are being developed to allow full customization of any dApp developed by the Ixo JAMBO Client.
  - Each action object has the following properties:
    - id: A unique identifier for the action.
    - steps: An array of steps that make up the action. Each step has an:
      - id from a list of predefined ids which corresponds to a specific screen to display (as seen below)
      - and a name for the step
    - name: The name of the action.
    - description: A description of what the action does.
    - image: An image associated with the action.
  - In the example object below, the action is called "Delegate" and has three steps. The first step is "Get validator address", the second is "Define amount to delegate", and the final step is "Review and sign". This particular action allows the user to delegate tokens on the IXO Network. The id property is a unique identifier for the action and it's used for navigation and routing, and the image property represents an image associated with the action (hence the image name corresponds with the action's id).
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
    - `staking_MsgDelegate` that generates a delegate transaction and allows a user to sign
    - `staking_MsgUndelegate` that generates an undelegate transaction and allows a user to sign
    - `staking_MsgRedelegate` that generates a redelegate transaction and allows a user to sign
    - `distribution_MsgWithdrawDelegatorReward` that generates a claim delegation rewards transaction and allows a user to sign

```
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

## .env

If you're not sure on what environment variables to set, then duplicate and use the default values as found in ".env.example". Simply duplicate the file and rename it to ".env". Done.

Else if you want to customize the dApp to use different or even multiple chains or chain networks then follow the steps below:

1. Create a new file named ".env" in the root directory of the project
2. Add the following environment variables to the .env file:
   - NEXT_PUBLIC_CHAIN_NAMES: This variable is a comma-separated list of names of any Cosmos chain as found in the [Cosmos chain registry](https://github.com/cosmos/chain-registry). The purpose of this variable is to specify which Cosmos chains the dApp should support.
   - NEXT_PUBLIC_ENABLE_MAINNET: This variable should be set to 1 if the dApp is being deployed to production. This variable is used to enable the dApp to connect to the mainnet.
   - NEXT_PUBLIC_ENABLE_TESTNET: This variable should be set to 1 if the dApp is being deployed for testing. This variable is used to enable the dApp to connect to the testnet (and devnet where applicable).
   - NEXT_PUBLIC_DEFAULT_NETWORK: This variable is used to specify the default network to connect to when both the testnet and mainnet are enabled.
   - NEXT_PUBLIC_DEFAULT_CHAIN_ID: This variable is used to specify the default chain ID to connect to if more than one chain is used.
3. Here is an example of the .env file with the above variables set (as seen in .env.example):

```
NEXT_PUBLIC_CHAIN_NAMES=impacthub
NEXT_PUBLIC_ENABLE_MAINNET=1
NEXT_PUBLIC_ENABLE_TESTNET=1
NEXT_PUBLIC_DEFAULT_NETWORK=testnet
NEXT_PUBLIC_DEFAULT_CHAIN_ID=pandora-7
```

---

## Wallets

The Ixo JAMBO client makes use of the following wallets:

- **Keplr**: This is a browser extension wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has a number of features including support for multiple chains, staking, governance voting, and more. Docs available [here](https://docs.keplr.app/api/).
- **Opera Wallet**: This is a mobile wallet that allows users to store, manage and interact with their cryptocurrencies securely. It has features such as a built-in browser, QR code scanner, and support for multiple chains. Docs available [here](https://help.opera.com/en/crypto/opera-wallet-integration-guide/).
- **WalletConnect**: This is a protocol for connecting decentralized applications to mobile wallets with QR code scanning. It is currently being implemented and will soon be available for use with the dApp.
