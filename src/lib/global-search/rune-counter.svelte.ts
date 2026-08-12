export function createRuneCounter() {
	let count = $state(0);

	return {
		get count() {
			return count;
		},
		increment() {
			count += 1;
		},
	};
}
