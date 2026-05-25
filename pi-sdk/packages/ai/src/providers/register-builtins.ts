import { clearApiProviders, registerApiProvider, type ApiProvider } from "../api-registry.js";
import type {
	Api,
	AssistantMessage,
	AssistantMessageEvent,
	Context,
	Model,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
} from "../types.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import type { AnthropicOptions } from "./anthropic.js";
import type { OpenAICompletionsOptions } from "./openai-completions.js";
import type { OpenAIResponsesOptions } from "./openai-responses.js";

interface LazyProviderModule<
	TApi extends Api,
	TOptions extends StreamOptions,
> {
	stream: (model: Model<TApi>, context: Context, options?: TOptions) => AsyncIterable<AssistantMessageEvent>;
	streamSimple: (
		model: Model<TApi>,
		context: Context,
		options?: SimpleStreamOptions,
	) => AsyncIterable<AssistantMessageEvent>;
}

function forwardStream(target: AssistantMessageEventStream, source: AsyncIterable<AssistantMessageEvent>): void {
	(async () => {
		for await (const event of source) {
			target.push(event);
		}
		target.end();
	})();
}

function createLazyLoadErrorMessage<TApi extends Api>(model: Model<TApi>, error: unknown): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "error",
		errorMessage: error instanceof Error ? error.message : String(error),
		timestamp: Date.now(),
	};
}

function createLazyStream<TApi extends Api, TOptions extends StreamOptions>(
	loadModule: () => Promise<LazyProviderModule<TApi, TOptions>>,
): StreamFunction<TApi, TOptions> {
	return (model, context, options) => {
		const outer = new AssistantMessageEventStream();

		loadModule()
			.then((module) => {
				const inner = module.stream(model, context, options);
				forwardStream(outer, inner);
			})
			.catch((error) => {
				const message = createLazyLoadErrorMessage(model, error);
				outer.push({ type: "error", reason: "error", error: message });
				outer.end(message);
			});

		return outer;
	};
}

function createLazySimpleStream<TApi extends Api, TOptions extends StreamOptions>(
	loadModule: () => Promise<LazyProviderModule<TApi, TOptions>>,
): StreamFunction<TApi, SimpleStreamOptions> {
	return (model, context, options) => {
		const outer = new AssistantMessageEventStream();

		loadModule()
			.then((module) => {
				const inner = module.streamSimple(model, context, options);
				forwardStream(outer, inner);
			})
			.catch((error) => {
				const message = createLazyLoadErrorMessage(model, error);
				outer.push({ type: "error", reason: "error", error: message });
				outer.end(message);
			});

		return outer;
	};
}

function createLazyLoader<
	TApi extends Api,
	TOptions extends StreamOptions,
>(
	api: TApi,
	importFn: () => Promise<any>,
	streamExport: string,
	streamSimpleExport: string,
): ApiProvider<TApi, TOptions> {
	let promise: Promise<LazyProviderModule<TApi, TOptions>> | undefined;
	const load = () => {
		promise ||= importFn().then((module) => ({
			stream: module[streamExport],
			streamSimple: module[streamSimpleExport],
		}));
		return promise;
	};
	return {
		api,
		stream: createLazyStream(load),
		streamSimple: createLazySimpleStream(load),
	};
}

const anthropicProvider = createLazyLoader(
	"anthropic-messages",
	() => import("./anthropic.js"),
	"streamAnthropic",
	"streamSimpleAnthropic",
);

const openAICompletionsProvider = createLazyLoader(
	"openai-completions",
	() => import("./openai-completions.js"),
	"streamOpenAICompletions",
	"streamSimpleOpenAICompletions",
);

const openAIResponsesProvider = createLazyLoader(
	"openai-responses",
	() => import("./openai-responses.js"),
	"streamOpenAIResponses",
	"streamSimpleOpenAIResponses",
);

export const streamAnthropic = anthropicProvider.stream;
export const streamSimpleAnthropic = anthropicProvider.streamSimple;
export const streamOpenAICompletions = openAICompletionsProvider.stream;
export const streamSimpleOpenAICompletions = openAICompletionsProvider.streamSimple;
export const streamOpenAIResponses = openAIResponsesProvider.stream;
export const streamSimpleOpenAIResponses = openAIResponsesProvider.streamSimple;

export function registerBuiltInApiProviders(): void {
	registerApiProvider(anthropicProvider);
	registerApiProvider(openAICompletionsProvider);
	registerApiProvider(openAIResponsesProvider);
}

export function resetApiProviders(): void {
	clearApiProviders();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();

