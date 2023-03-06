# Developer Documentation: Adding a Donation Step to the ixo JAMBO Client

The ixo JAMBO client is built with NEXTJS and uses the @ixo/impactxclient-sdk for all chain-related transactions. This client allows you to build dApps with one or more actions (such as send tokens or delegate in a validator, etc.) and each action consists of one or more steps.

A step allows a user to do one of 2 things:

- capture data to be used in the transaction (such as providing an account address or defining an amount to send)
- sign and broadcast a transaction (review and then approve the transaction)

This documentation will guide developers on how to create a new step in the ixo JAMBO client that captures whether a user wants to donate a predefined amount and denom to a predefined address along with the current transaction.

### Step 1: Define the Step ID and Types

First you'll to create an ID for the new step. We recommend choosing a descriptive name for the step ID. In this example, the step ID will be "request_donation" and it'll be added to the [/types/steps.ts](/types/steps.ts) file as such:

```ts
export enum STEPS {
  // ... existing step IDs
  request_donation = 'request_donation',
}
```

Next, set up some default step data. Only the step ID and name are required for the default. Add the following code to the /types/steps.ts file:

```ts
export const steps: { [key in STEPS]: STEP } = {
  // ... existing steps defaults
  [STEPS.request_donation]: {
    id: STEPS.request_donation,
    name: 'Request a donation',
  },
};
```

Since this step requires additional configuration, we need to define a config type that includes the predefined donation amount, denom, and destination address. Add the following code to the /types/steps.ts file:

```ts
interface Request_donation_config {
  request?: string;
  amount: number;
  denom: string;
  address: string;
}
```

Now, add this config type to AllStepConfigTypes and StepConfigType. Use the following code:

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

Lastly, define the data type that the new step should capture. In this example, the new step only needs to capture whether the user approves donating the predefined amount to the address. Add the following code to the /types/steps.ts file:

```ts
interface Request_donation {
  donate: boolean;
}
```

Since we have defined a new data type, we need to add it to AllStepDataTypes and StepDataType. Use the following code:

```ts
export type AllStepDataTypes =
  // ... existing step data types
  | Request_donation;

export type StepDataType<T> =
  // ... existing step data types
 ? Request_donation
  : T extends STEPS.request_donation
  // ... the rest of the existing step data types (always end with `never` as default)
```

By completing these steps, we have successfully defined the new step ID, config type, and data type that will be used by the rest ixo JAMBO client.

### Step 2: Define the step component
