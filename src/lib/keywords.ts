export const STOPWORDS = new Set([
	'the','and','for','are','but','not','you','all','any','can','has','had','his','her',
	'its','our','out','who','get','how','why','when','what','where','will','would','could',
	'should','may','might','this','that','these','those','with','from','into','than','then',
	'they','them','their','been','were','also','more','most','such','only','other','some',
	'able','using','used','use','well','like','just','over','under','about','after','before',
	'between','during','through','above','below','each','every','both','few','many','much',
	'per','via','etc','include','includes','including','required','require','requirements',
	'preferred','plus','across','within','without','youll','weve','youre','looking','join',
	'work','working','works','role','roles','job','jobs','position','candidate','team',
	'company','experience','years','year','strong','good','new','great','help','ensure'
]);

export function asText(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value == null) return '';
	return String(value);
}

export function keywords(text: unknown): Set<string> {
	return new Set(
		asText(text)
			.toLowerCase()
			.split(/[^a-z0-9+#.]+/)
			.map((w) => w.replace(/^[.+#]+|[.+#]+$/g, ''))
			.filter((w) => w.length >= 3 && !STOPWORDS.has(w))
	);
}
