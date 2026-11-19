import type { IDataObject, IHookFunctions, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from "n8n-workflow";
import { createHmac, timingSafeEqual } from "crypto";

const EVENTS = [
	{ name: "Card Created", value: "card.created", description: "Someone adds the card to their Wallet" },
	{ name: "Stamp Added", value: "stamp.added" },
	{ name: "Stamp Undone", value: "stamp.undone" },
	{ name: "Reward Earned", value: "reward.earned", description: "A card is full" },
	{ name: "Reward Redeemed", value: "reward.redeemed" },
	{ name: "Location Quiet", value: "location.quiet", description: "A location stamped much less than usual yesterday" },
	{ name: "Alert Raised", value: "alert.raised", description: "Something does not add up at the counter" },
	{ name: "Daily Summary", value: "daily.summary", description: "The numbers of the day, every night" },
	{ name: "Review Created", value: "review.created", description: "A new review on the Google Business Profile" },
	{ name: "NFC Tapped", value: "nfc.tapped", description: "Someone tapped a Passello NFC sticker (no personal data)" },
];

export class PasselloTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Passello Trigger",
		name: "passelloTrigger",
		icon: "file:passello.png",
		group: ["trigger"],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: "Starts the workflow when something happens in Passello",
		defaults: { name: "Passello Trigger" },
		inputs: [],
		outputs: ["main"],
		credentials: [{ name: "passelloApi", required: true }],
		webhooks: [{ name: "default", httpMethod: "POST", responseMode: "onReceived", path: "webhook" }],
		properties: [
			{
				displayName: "Events",
				name: "events",
				type: "multiOptions",
				required: true,
				default: ["stamp.added"],
				options: EVENTS,
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData("node");
				return !!data.hookId;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const creds = await this.getCredentials("passelloApi");
				const base = String(creds.baseUrl).replace(/\/$/, "");
				const res = (await this.helpers.httpRequestWithAuthentication.call(this, "passelloApi", {
					method: "POST",
					url: `${base}/hooks`,
					body: { target_url: this.getNodeWebhookUrl("default"), events: this.getNodeParameter("events") as string[], source: "n8n" },
					json: true,
				})) as IDataObject;
				const data = this.getWorkflowStaticData("node");
				data.hookId = res.id;
				data.secret = res.secret;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData("node");
				if (!data.hookId) return true;
				const creds = await this.getCredentials("passelloApi");
				const base = String(creds.baseUrl).replace(/\/$/, "");
				try {
					await this.helpers.httpRequestWithAuthentication.call(this, "passelloApi", { method: "DELETE", url: `${base}/hooks/${data.hookId}`, json: true });
				} catch {
					// Ya no existia: nada que hacer.
				}
				delete data.hookId;
				delete data.secret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const secret = this.getWorkflowStaticData("node").secret as string | undefined;
		const id = req.headers["webhook-id"] as string | undefined;
		const ts = req.headers["webhook-timestamp"] as string | undefined;
		const sig = req.headers["webhook-signature"] as string | undefined;
		const raw = (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? JSON.stringify(req.body);
		if (secret && id && ts && sig) {
			const expected = `v1,${createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64")).update(`${id}.${ts}.${raw}`).digest("base64")}`;
			const ok = sig.split(" ").some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
			const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;
			if (!ok || !fresh) return { webhookResponse: { status: 401 }, noWebhookResponse: false };
		}
		const body = req.body as IDataObject;
		return { workflowData: [this.helpers.returnJsonArray([body.data as IDataObject])] };
	}
}
