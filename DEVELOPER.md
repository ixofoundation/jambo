# Developer Documentation: Adding a Step to the ixo JAMBO Client

JAMBO is a NEXTJS-based dApp development tool that relies on the @ixo/impactxclient-sdk to facilitate blockchain-related transactions. Each dApp built with JAMBO includes one or more actions, such as sending tokens or delegating to a validator. Each action contains one or more steps, which enable users to either capture data for the transaction or sign and broadcast the transaction.

This documentation outlines the process for creating a new step in JAMBO and uses an example step that enables users to donate a predefined amount and denom to a predefined address as part of the action.

### Prerequisites

Before proceeding, ensure that you have the following:

- An understanding of JAMBO's structure and functionality
- Familiarity with JavaScript and React

## Step 1: Define the Step ID and Types

Create a descriptive ID for the new step, and add it to the [/types/steps.ts](/types/steps.ts) file as an enum. For this example, the step is called "request_donation," the ID would look like this:

```ts
export enum STEPS {
  // ... existing step IDs
  request_donation = 'request_donation',
}
```

Next, create default fallback configs for the step in case a dApp's configuration is incorrect. For this example, only the step ID and name are required, so in the [/types/steps.ts](/types/steps.ts) file, it would look something like this:

```ts
export const steps: { [key in STEPS]: STEP } = {
  // ... existing steps defaults
  [STEPS.request_donation]: {
    id: STEPS.request_donation,
    name: 'Request a donation',
  },
};
```

Unlike most other steps, this step requires predefined values for the donation amount, token, and address. Thus a config structure needs to be defined to allow dApp creators to provide these values in the configuration. The config structure should be defined in the [/types/steps.ts](/types/steps.ts) file, like this:

```ts
interface Request_donation_config {
  request?: string;
  amount: number;
  denom: string;
  address: string;
}
```

To make use of this config structure, add it to AllStepConfigTypes and StepConfigType. The following code should be used in the [/types/steps.ts](/types/steps.ts) file:

```ts
export type AllStepConfigTypes =
  // ... existing step config types
  | Request_donation_config;

export type StepConfigType<T> =
  // ... existing step config types
  : T extends STEPS.request_donation
  ? Request_donation_config
  // ... the rest of the existing step config types (always end with `never` as default)
```

Lastly, if the step captures data, its structure needs to be defined. For this example, the step only needs to capture whether the user approves donating the predefined amount to the address. Add the following code to the [/types/steps.ts](/types/steps.ts) file:

```ts
interface Request_donation {
  donate: boolean;
}
```

To make use of this data structure, add it to AllStepDataTypes and StepDataType. The following code should be used in the [/types/steps.ts](/types/steps.ts) file:

```ts
export type AllStepDataTypes =
  // ... existing step data types
  | Request_donation;

export type StepDataType<T> =
  // ... existing step data types
  : T extends STEPS.request_donation
  ? Request_donation
  // ... the rest of the existing step data types (always end with `never` as default)
```

By completing these steps, a new step ID, step config structure, and step data structure will be successfully defined and ready to use in the JAMBO.

## Step 2: Define the step component

Next we'll have to create a component for the step to capture the step's data. We'll make use of predefined components in most cases and if you want to know what these predefined components have to offer, check them out at `/components/`.

To create the screen for the `request_donation` step, create a new file called `RequestDonation.tsx` under `/steps/` then copy and paste the following react component's code.

```tsx
import { FormEvent, useContext, useState, FC, MouseEvent } from 'react';
import cls from 'classnames';

import utilsStyles from '@styles/utils.module.scss';
import styles from '@styles/stepsPages.module.scss';
import Button, { BUTTON_BG_COLOR, BUTTON_COLOR, BUTTON_SIZE } from '@components/Button/Button';
import AmountAndDenom from '@components/AmountAndDenom/AmountAndDenom';
import Card, { CARD_SIZE } from '@components/Card/Card';
import IconText from '@components/IconText/IconText';
import Header from '@components/Header/Header';
import Footer from '@components/Footer/Footer';
import SadFace from '@icons/sad_face.svg';
import { StepConfigType, StepDataType, STEPS } from 'types/steps';
import { WalletContext } from '@contexts/wallet';

type RequestDonationProps = {
  // onSuccess is a function passed in from higher up that saves the captured data and moves the user to the next step when called
  onSuccess: (data: StepDataType<STEPS.request_donation>) => void;
  // onBack is a function passed in from higher up that navigates the user to the appropriate previous step when called
  onBack?: () => void;
  // data is an optional object that contains previously captured data for this step
  data?: StepDataType<STEPS.request_donation>;
  // config contains the required configuration data for this step
  config?: StepConfigType<STEPS.request_donation>;
  // header is an optional string used to display a title for this step
  header?: string;
};

const RequestDonation: FC<RequestDonationProps> = ({ onSuccess, onBack, config, data, header }) => {
  // Declare the state variables
  const [donationApproved, setDonationApproved] = useState<boolean | undefined>(data?.donate);
  // Extract the wallet context variables
  const { wallet } = useContext(WalletContext);

  // Define the handleClick function which updates the donationApproved state variable
  const handleClick = (bool: boolean) => (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setDonationApproved(bool);
  };

  // Define the formIsValid function which checks if the donationApproved state variable has a valid boolean value
  const formIsValid = () => typeof donationApproved === 'boolean';

  // Define the handleSubmit function which triggers the onSuccess function with the donationApproved value as input
  const handleSubmit = (event: FormEvent<HTMLFormElement> | null) => {
    event?.preventDefault();
    if (!formIsValid()) return alert('A token is required and amount must be bigger than 0 and less than balance.');
    onSuccess({ donate: donationApproved as boolean });
  };

  return (
    <>
      {/* Render the header component (used by all components) */}
      <Header header={header} />

      {/* Render the main content (used by all components) */}
      <main className={cls(utilsStyles.main, utilsStyles.columnJustifyCenter, styles.stepContainer)}>
        {/*
				Conditional rendering based on whether the donation configuration is set
				Show a warning screen in case the creator of the dapp forgot one of the configs for the screen which'll prevent the donation transaction from executing successfully
				*/}
        {!config?.address || !config.amount || !config.denom ? (
          <IconText title='Donation configuration not set' Img={SadFace} imgSize={50}>
            <Button label='Skip Donation' bgColor={BUTTON_BG_COLOR.lightGrey} />
          </IconText>
        ) : /*
				Conditional rendering based on whether the user has any tokens to donate
				Show a warning screen when a user has no tokens to donate (!wallet.balances.balances)
				*/
        wallet.balances?.data ? (
          <form className={styles.stepsForm} autoComplete='none'>
            <p className={utilsStyles.label}>{config.prompt ?? 'Would you like to make a donation of'}</p>
            <div className={utilsStyles.spacer1} />
            <AmountAndDenom amount={config.amount} denom={config.denom} />
            <div className={utilsStyles.spacer1} />
            <Card rounded size={CARD_SIZE.mediumLarge}>
              {config.addressName ?? config.address}
            </Card>
            <div className={utilsStyles.spacer3} />
            <div className={utilsStyles.rowJustifySpaceAround}>
              <Button
                label='NO'
                rounded
                size={BUTTON_SIZE.mediumLarge}
                bgColor={!donationApproved ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.lightGrey}
                color={!donationApproved ? BUTTON_COLOR.lightGrey : BUTTON_COLOR.primary}
                onClick={handleClick(false)}
              />
              <Button
                label='YES'
                rounded
                size={BUTTON_SIZE.mediumLarge}
                bgColor={donationApproved ? BUTTON_BG_COLOR.primary : BUTTON_BG_COLOR.lightGrey}
                color={donationApproved ? BUTTON_COLOR.lightGrey : BUTTON_COLOR.primary}
                onClick={handleClick(true)}
              />
            </div>
            {/* <DonationForm approved={donationApproved} onApprove={setDonationApproved} /> */}
          </form>
        ) : (
          <IconText title="You don't have any tokens to donate." Img={SadFace} imgSize={50}>
            <Button label='Skip Donation' bgColor={BUTTON_BG_COLOR.lightGrey} />
          </IconText>
        )}
      </main>

      {/* Render the footer component (used by all components) */}
      <Footer
        onBack={onBack}
        onBackUrl={onBack ? undefined : ''}
        onForward={formIsValid() ? () => handleSubmit(null) : null}
      />
    </>
  );
};

export default RequestDonation;
```

Once the step component is built, we need to add it to the actions page so that it can be rendered when a dApp reaches the donation step. To do this, we will modify the getStepComponent function in the [[actionId].tsx](./pages/%5BactionId%5D.tsx) file.

To add the new RequestDonation component, import it and add it to the switch statement within the getStepComponent function:

```tsx
const getStepComponent = (step: STEP) => {
  switch (step.id) {
    // existing switch cases
    case STEPS.request_donation:
      return (
        <RequestDonation
          onSuccess={handleOnNext<STEPS.request_donation>}
          onBack={handleBack}
          data={step.data as StepDataType<STEPS.request_donation>}
          header={action?.name}
          config={step.config as StepConfigType<STEPS.request_donation>}
        />
      );
  }
};
```

Once added, the step should display for any action that contains the request_donation step and it should appropriately capture the data it requires. However, it will not be added to the end transaction just yet.

## Step 3: Define the transaction (if applicable)

The donation (if approved) will be executed as a send transaction during the action's final "Review and Sign" step. To enable this, we need to extract the donation data where applicable in the [ReviewAndSign.tsx](./steps/ReviewAndSign.tsx) file and add it to the component state so that the Review Component is aware of this transaction.

First declare this new donation type in [actions.ts](./types/actions.ts):

```ts
// other defined types
export type DONATION = {
  address: string;
  amount: number;
  denom: string;
};
```

Then import and use this type to declare a donation state in [ReviewAndSign.tsx](./steps/ReviewAndSign.tsx) as follows:

```tsx
const ReviewAndSign: FC<ReviewAndSignProps> = ({ onSuccess, onBack, steps, header, message }) => {
  // other defined state
  const [donation, setDonation] = useState<DONATION | undefined>();
  // rest of component logic
};
```

You'll notice that within a useEffect hook, we loop over all the steps to save the steps' data to the component state to create the transaction objects. To save the donation data to the component state, add the following logic in this useEffect hook in [ReviewAndSign.tsx](./steps/ReviewAndSign.tsx):

```tsx
useEffect(() => {
  steps.forEach((s) => {
    // other steps' logic
    if (s.id === STEPS.request_donation) {
      if ((s.data as StepDataType<STEPS.request_donation>)?.donate && s.config)
        setDonation({ address: s.config?.address, amount: s.config?.amount, denom: s.config?.denom });
    }
  });
}, [steps]);
```

To display the donation info if the user approved, add the following component just before closing the main tag in [ReviewAndSign.tsx](./steps/ReviewAndSign.tsx):

```tsx
// other component logic
{
  !!donation && (
    <>
      <br />
      <Card className={utilsStyles.columnAlignCenter}>
        <p className={utilsStyles.label}>Donating</p>
        <AmountAndDenom amount={donation.amount} denom={donation.denom} />
      </Card>
    </>
  );
}
// other component logic
```

To include the donation in the transaction when the user signs and broadcasts it, modify the `signTX` function in [ReviewAndSign.tsx](./steps/ReviewAndSign.tsx):

```tsx
const signTX = async (): Promise<void> => {
  // other signTX logic
  if (donation)
    msg.push(
      generateBankSendTrx({
        fromAddress: wallet.user!.address,
        toAddress: donation.address,
        denom: donation.denom ?? '',
        amount: getMicroAmount(donation.amount.toString(), 0),
      }),
    );

  if (donation) memo = `Donation of ${donation.amount} ${donation.denom} to ${donation.address}`;
  // rest of signTX logic
};
```

With these modifications, the "Review and Sign" screen is now aware of the donation and the user can review it before signing and broadcasting their transaction.

## Step 4: Test the step locally

After completing all of the steps above, you'll have created your own step to be used in a JAMBO dApp's action(s). Next you'll have to test it. You can add the `request_donation` step to any of the example actions in [config.json](constants/config.json) and test it out. Here's an example of a `request_donation` step config (not a real address):

```json
// ...previous steps
{
  "id": "request_donation",
  "name": "Donate",
  "config": {
    "amount": 1,
    "denom": "ixo",
    "address": "ixo1ab2cd3ef4gh5ij6kl7mo8np9qr0st",
    "prompt": "Support the Jambo Developer with a donation?",
    "addressName": "Jambo Developer"
  }
},
// ...next steps
```

Make sure you have all the necessary programs and packages installed then run the project locally on your machine with

```sh
yarn dev
```

And test your step at `localhost:3000`

## Done

Congratulations! You have successfully added a new donation step to the JAMBO client. Test it out. If it's not working, make sure you followed all the steps of this doc.

However, there is still room for improvement. Here are some ideas:

- Improve the appearance of the donation component on the review screen.
- Allow users to specify the amount and/or token of their donation.
- Enable creators to add multiple addresses, and have the dApp select one randomly for added account safety.
- Create a "Thank you" component to display when a donation is complete.
- Get creative and use your imagination to come up with even more improvements!
