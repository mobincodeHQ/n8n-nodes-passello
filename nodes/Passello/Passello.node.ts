import type { IDataObject, IExecuteFunctions, JsonObject, IHttpRequestMethods, INodeExecutionData, INodeType, INodeTypeDescription } from "n8n-workflow";
import { NodeApiError, NodeConnectionTypes } from "n8n-workflow";

// Passello answers errors as {"error": code}. These are the codes a workflow can hit.
const MESSAGES: Record<string, string> = {
	"scan.passNotFound": "No card with this code in this business.",
	"scan.notReady": "The card is not full yet, so the reward cannot be redeemed.",
	"scan.full": "The card is already full. Redeem the reward first.",
	"scan.dailyCap": "This card already reached the daily stamp limit of this location.",
	"api.locationRequired": "This business has more than one location. Fill in Location ID (use the Location > Get Many operation).",
	"api.locationNotFound": "This Location ID does not exist in this business.",
	"api.unauthorized": "The Passello API key is wrong or was revoked.",
};

function passelloCode(error: unknown): string | undefined {
	let text = "";
	try {
		text = JSON.stringify(error, Object.getOwnPropertyNames(error as object));
	} catch {
		text = String(error);
	}
	return /\\?"error\\?"\s*:\s*\\?"([a-zA-Z]+\.[a-zA-Z]+)/.exec(text)?.[1];
}

export class Passello implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Passello",
		name: "passello",
		icon: { light: "file:../../icons/passello.svg", dark: "file:../../icons/passello.dark.svg" },
		group: ["transform"],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: "Add stamps, redeem rewards and read numbers from Passello loyalty cards",
		defaults: { name: "Passello" },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: "passelloApi", required: true }],
		properties: [
			{
				displayName: "Resource",
				name: "resource",
				type: "options",
				noDataExpression: true,
				options: [
					{ name: "Card", value: "card" },
					{ name: "Location", value: "location" },
					{ name: "Summary", value: "summary" },
				],
				default: "card",
			},
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: { show: { resource: ["card"] } },
				options: [
					{ name: "Add Stamps", value: "stamp", action: "Add stamps to a card" },
					{ name: "Get", value: "get", action: "Get a card" },
					{ name: "Redeem Reward", value: "redeem", action: "Redeem the reward of a full card" },
				],
				default: "stamp",
			},
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: { show: { resource: ["location"] } },
				options: [{ name: "Get Many", value: "getAll", action: "Get many locations" }],
				default: "getAll",
			},
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				displayOptions: { show: { resource: ["summary"] } },
				options: [{ name: "Get", value: "get", action: "Get the numbers of a day" }],
				default: "get",
			},
			{
				displayName: "Card Code",
				name: "code",
				type: "string",
				required: true,
				default: "",
				placeholder: "K7M-2Q9",
				description: "The code printed on the card, or the content of its QR",
				displayOptions: { show: { resource: ["card"] } },
			},
			{
				displayName: "Quantity",
				name: "quantity",
				type: "number",
				typeOptions: { minValue: 1, maxValue: 50 },
				default: 1,
				description: "The location's own limits still apply",
				displayOptions: { show: { resource: ["card"], operation: ["stamp"] } },
			},
			{
				displayName: "Location ID",
				name: "locationId",
				type: "string",
				default: "",
				description: "Only needed when the business has more than one location",
				displayOptions: { show: { resource: ["card", "summary"], operation: ["stamp", "redeem", "get"] } },
			},
			{
				displayName: "Date",
				name: "date",
				type: "string",
				default: "",
				placeholder: "2026-11-05",
				description: "YYYY-MM-DD in the location's local time. Empty means today.",
				displayOptions: { show: { resource: ["summary"] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const creds = await this.getCredentials("passelloApi");
		const base = String(creds.baseUrl).replace(/\/$/, "");

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter("resource", i) as string;
			const operation = this.getNodeParameter("operation", i) as string;
			let method: IHttpRequestMethods = "GET";
			let url = "";
			let body: IDataObject | undefined;
			const qs: IDataObject = {};

			if (resource === "card") {
				const code = encodeURIComponent((this.getNodeParameter("code", i) as string).trim());
				const locationId = (this.getNodeParameter("locationId", i, "") as string) || undefined;
				if (operation === "get") url = `/cards/${code}`;
				if (operation === "stamp") {
					method = "POST";
					url = `/cards/${code}/stamps`;
					body = { quantity: this.getNodeParameter("quantity", i) as number, ...(locationId ? { location_id: locationId } : {}) };
				}
				if (operation === "redeem") {
					method = "POST";
					url = `/cards/${code}/redeem`;
					body = locationId ? { location_id: locationId } : {};
				}
			} else if (resource === "location") {
				url = "/locations";
			} else {
				url = "/summary";
				const date = this.getNodeParameter("date", i, "") as string;
				const locationId = this.getNodeParameter("locationId", i, "") as string;
				if (date) qs.date = date;
				if (locationId) qs.location_id = locationId;
			}

			try {
				const res = (await this.helpers.httpRequestWithAuthentication.call(this, "passelloApi", { method, url: base + url, body, qs, json: true })) as IDataObject;
				const rows = resource === "location" ? (res.data as IDataObject[]) : [res];
				for (const r of rows) out.push({ json: r, pairedItem: { item: i } });
			} catch (error) {
				const code = passelloCode(error);
				const message = code ? (MESSAGES[code] ?? code) : undefined;
				if (this.continueOnFail()) {
					out.push({ json: { error: message ?? (error as Error).message, code }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message, itemIndex: i } : { itemIndex: i });
			}
		}
		return [out];
	}
}
