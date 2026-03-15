/**
 * Stub for mongoose on Cloudflare Workers (no TCP). Use MONGODB_URI + real mongoose on Node.
 */
const emptyArr = () => Promise.resolve([])
const emptyOne = () => Promise.resolve(null)
const emptyInsert = () => Promise.resolve({ _id: 'stub', insertedId: 'stub' })
const emptyUpdate = () => Promise.resolve({ matchedCount: 0, modifiedCount: 0 })

function chain(leanResult: () => Promise<unknown>) {
	const link = {
		sort: () => link,
		limit: () => link,
		select: () => link,
		lean: leanResult,
	}
	return link
}

function stubModel() {
	return {
		find: () => chain(emptyArr),
		findOne: () => chain(emptyOne),
		create: emptyInsert,
		updateOne: emptyUpdate,
	}
}

const Schema = Object.assign(function () {}, { Types: { Mixed: Object } })
const stub = {
	connect: () => Promise.resolve(),
	connection: { readyState: 0 },
	models: {},
	model: stubModel,
	Schema,
	disconnect: () => Promise.resolve(),
}

export default stub
export { Schema }
export const model = stubModel
