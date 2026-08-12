export type PrivacyChecks = {
	expectNetworkApisBlocked: () => Promise<void>;
	expectConsoleLeakDetected: (token: string) => Promise<void>;
};

type PrivacyCheckOrder = {
	navigate: () => Promise<void>;
	assertIdentity: () => Promise<void>;
	createPrivacyGuards: () => PrivacyChecks;
	consoleLeakToken: string;
};

export async function runPrivacyChecksAfterIdentity({
	navigate,
	assertIdentity,
	createPrivacyGuards,
	consoleLeakToken,
}: PrivacyCheckOrder) {
	await navigate();
	await assertIdentity();

	const privacy = createPrivacyGuards();
	await privacy.expectNetworkApisBlocked();
	await privacy.expectConsoleLeakDetected(consoleLeakToken);
}
