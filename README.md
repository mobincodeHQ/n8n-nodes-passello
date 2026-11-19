# n8n-nodes-passello

n8n nodes for [Passello](https://passellocard.com), loyalty cards that live in Apple Wallet and Google Wallet.

This package has two nodes:

- **Passello**: add stamps to a card, redeem a reward, get a card, get the locations of the business and get the numbers of a day.
- **Passello Trigger**: starts a workflow when something happens in Passello.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Trigger events](#trigger-events) · [Example workflows](#example-workflows) · [Errors](#errors)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `@passello/n8n-nodes-passello`.

## Credentials

The nodes use an API key of your Passello business.

1. Sign in to the Passello dashboard and open **Connectors**. The API is available on the Pro and Group plans.
2. Create an API key. It starts with `psl_`. Copy it: it is shown only once.
3. In n8n, create a **Passello API** credential and paste the key in **API Key**. Leave **Base URL** as it is.

n8n checks the key when you save the credential. Each key belongs to one business; to revoke it, delete it in **Connectors**.

## Operations

| Resource | Operation | What it does |
|---|---|---|
| Card | Add Stamps | Adds one or more stamps to a card. The limits of the location (stamps per visit, per day, time between stamps) still apply. |
| Card | Get | Returns a card: stamps, goal, whether the reward is ready, last visit. |
| Card | Redeem Reward | Redeems the reward of a full card and starts it again. |
| Location | Get Many | Lists the locations of the business, with their IDs. |
| Summary | Get | The numbers of a day for each location: stamps, visitors and rewards redeemed. Empty date means today. |

**Card Code** is the code printed on the card (for example `K7M-2Q9`) or the content of its QR code.

**Location ID** is only needed when the business has more than one location. Get it with Location > Get Many.

The Passello node can also be used as a tool by the n8n AI Agent.

## Trigger events

| Event | When |
|---|---|
| Card Created | Someone adds the card to their Wallet |
| Stamp Added | A stamp is added |
| Stamp Undone | A stamp is undone |
| Reward Earned | A card is full |
| Reward Redeemed | A reward is redeemed |
| Location Quiet | A location stamped much less than usual yesterday |
| Alert Raised | Something does not add up at the counter |
| Daily Summary | The numbers of the day, every night |
| Review Created | A new review on the Google Business Profile |
| NFC Tapped | Someone tapped a Passello NFC sticker (no personal data) |

When you activate the workflow, the trigger registers its webhook in Passello. When you deactivate it, the webhook is removed. Every request is signed ([Standard Webhooks](https://www.standardwebhooks.com)) and the trigger rejects requests with a wrong signature or older than five minutes.

## Example workflows

- **New card in a sheet**: Passello Trigger (Card Created) → Google Sheets (Append Row).
- **Reward ready, tell the staff**: Passello Trigger (Reward Earned) → Slack or Telegram message to the manager of the location.
- **Daily report by email**: Passello Trigger (Daily Summary) → Gmail, with the stamps and rewards of each location.
- **Stamp from another system**: Webhook from your till or online shop → Passello (Card > Add Stamps) with the card code of the order.
- **Answer a quiet day**: Passello Trigger (Location Quiet) → email to the owner.

## Errors

Passello errors come back as clear messages, for example:

- `No card with this code in this business.`
- `The card is not full yet, so the reward cannot be redeemed.`
- `This card already reached the daily stamp limit of this location.`
- `This business has more than one location. Fill in Location ID (use the Location > Get Many operation).`
- `The Passello API key is wrong or was revoked.`

Turn on **Continue On Fail** to get the message and its code in the output instead of stopping the workflow.

## Resources

- [Passello for developers](https://passellocard.com/developers)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE)
