# JAMBO Client

This repo and product is intentionally managed as Open Source and we aim to use this guide to light our way https://opensource.guide/.  
Let us know how we are doing!

## How to create a dApp using this repo

This [documentation](CLIENT.md) will guide you through the process of creating your own dApp using the Ixo JAMBO client.

## How to contribute to this repo

First off, thank you for applying your mind and time to improving this repo - it helps the Internet of Impact to save our planet!  
Whether you are contributing in your own space-time or following a bounty; we are grateful!

1. Fork the repo or submodule.
2. Ensure that you sync the fork often.
3. Clone your fork and create a branch that conforms to Github naming conventions.
4. Implement your changes one at a time and commit regularly to your fork.
5. Once your change is completed and passes all of the local tests, create a PR on the EartPort repo.
6. Your change will be reviewed as soon as possible with helpful feedback for your further updates to the change.
7. Finally, when everything is good to go and your PR approved, you can squash and merge your branch.

## Bounties

We know that it is not always easy to contribute without receiving some compensation for it.
Therefore, we may attach bounties to some of the issues.
Feel free to provide feedback on the issues about your thoughts on the amount offered.

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
