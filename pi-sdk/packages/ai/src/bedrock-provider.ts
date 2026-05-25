export const bedrockProviderModule = {
	streamBedrock: () => {
		throw new Error("Bedrock support is disabled");
	},
	streamSimpleBedrock: () => {
		throw new Error("Bedrock support is disabled");
	},
};

export function setBedrockProviderModule(module: any): void {
	// Dummy implementation for compatibility
}

