# Making demo & tutorial videos with Claude Code

You can ask Claude Code to produce a polished video of any flow in the
jambo/Yoma claims app — no screen recording, no video editing. Claude drives
the app, takes a screenshot at every step, and renders an MP4 with a title
card, a phone frame, tap animations and captions.

Example of what you get: a 1080p video showing the phone on the left and a
caption on the right for each step ("Tap a collection card to open it", …).

## Before you start (one-time, per computer)

Open Claude Code in this repository and say:

> Set up the demo-videos tooling so I can generate tutorial videos.

Claude installs what's needed. You only do this once.

## Asking for a video

Just describe the flow in plain language, like you'd explain it to a
colleague. Good requests say **where it starts, what the person does, and
where it ends**. Examples:

> Make a tutorial video showing how to sign in and get to the project dashboard.

> Create a demo of submitting a claim: open the collection, fill in the form, submit it.

> I need a short video showing how to navigate the home screen — opening a collection, going back, opening the profile.

> Make a video of applying to become a contributor on a collection.

Claude will run the app, walk through the flow, render the video and hand you
the MP4 file. Expect it to take a few minutes.

Videos that already exist and can be re-generated any time:
`sign-in`, `submit-claim`, `apply-as-agent`, `home-tour`. Just ask, e.g.
"regenerate the submit-claim video".

## Making it look the way you want

You can shape the result — tell Claude things like:

- **Captions:** "Change step 3's caption to …" / "Use friendlier wording."
- **Pacing:** "Hold the last screen a bit longer." / "Make it shorter."
- **Content:** "Show two collections on the dashboard instead of one." /
  "Name the project *Kabwe Tree Planting*."
- **Title:** "Call the video *Your first claim*."

Then say "regenerate it" and you'll get a new MP4.

## Good to know

- The video uses **demo data, not real accounts** — the project, collection
  and claims you see are made up for the video. Nothing is sent to a real
  server or the blockchain. You can ask Claude to change the demo data.
- The videos show the app **as it is today**. If the app changes, ask Claude
  to regenerate a video and it will reflect the new screens.
- Only flows the app actually supports can be shown. If you ask for
  something the app can't do (e.g. a swipe gesture that doesn't exist),
  Claude will tell you and suggest the closest thing.
- Finished videos are saved in `demo-videos/out/`. Screenshots of each step
  are in `demo-videos/public/captures/<video-name>/` — handy for written
  docs or slides.

## If something goes wrong

Just tell Claude what you saw ("the video stops at the form", "the caption
is wrong", "it failed"). It can see what went wrong and fix it. There's
nothing you need to debug yourself.
