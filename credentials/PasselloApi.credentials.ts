import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class PasselloApi implements ICredentialType {
	name = "passelloApi";
	displayName = "Passello API";
	documentationUrl = "https://passellocard.com/developers";
	properties: INodeProperties[] = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string",
			typeOptions: { password: true },
			default: "",
			required: true,
			description: "Create it in the Passello dashboard, under Connectors. It starts with psl_.",
		},
		{
			displayName: "Base URL",
			name: "baseUrl",
			type: "string",
			default: "https://api.passellocard.com/api/v1",
			description: "Leave as it is unless Passello support tells you otherwise",
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: "generic",
		properties: { headers: { Authorization: "=Bearer {{$credentials.apiKey}}" } },
	};
	test: ICredentialTestRequest = { request: { baseURL: "={{$credentials.baseUrl}}", url: "/me" } };
}
