import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import process from 'node:process'

if (existsSync('.env')) process.loadEnvFile('.env')

const webhookUrl = process.env.COOLIFY_DEPLOY_WEBHOOK_URL?.trim()
const token = process.env.COOLIFY_DEPLOY_TOKEN?.trim()

if (!webhookUrl || !token) {
	console.error('Set COOLIFY_DEPLOY_WEBHOOK_URL and COOLIFY_DEPLOY_TOKEN in .env before deploying.')
	process.exit(1)
}

let parsedUrl
try {
	parsedUrl = new URL(webhookUrl)
} catch {
	console.error('COOLIFY_DEPLOY_WEBHOOK_URL must be a valid URL.')
	process.exit(1)
}

if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
	console.error('COOLIFY_DEPLOY_WEBHOOK_URL must use HTTP or HTTPS.')
	process.exit(1)
}

const deploymentUuid = parsedUrl.searchParams.get('uuid')
if (!deploymentUuid) {
	console.error('COOLIFY_DEPLOY_WEBHOOK_URL must include the Coolify deployment UUID as ?uuid=…')
	process.exit(1)
}

const args = process.argv.slice(2)
let confirmed = args.includes('--yes') || args.includes('-y')

if (!confirmed) {
	const prompt = createInterface({ input: process.stdin, output: process.stdout })
	try {
		const answer = await prompt.question(
			'Trigger the Coolify deployment for the configured project? Coolify deploys its configured branch. [y/N] ',
		)
		confirmed = ['y', 'yes'].includes(answer.trim().toLowerCase())
	} finally {
		prompt.close()
	}
}

if (!confirmed) {
	console.log('Deployment cancelled.')
	process.exit(0)
}

try {
	const response = await fetch(parsedUrl, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`,
		},
	})
	if (!response.ok) {
		const responseBody = (await response.text())
			.replaceAll(token, '[redacted]')
			.replaceAll(deploymentUuid, '[redacted]')
			.slice(0, 1000)
		throw new Error(
			`Coolify returned HTTP ${response.status}.${responseBody ? ` Response: ${responseBody}` : ''}`,
		)
	}
	console.log('Coolify deployment triggered successfully.')
} catch (error) {
	console.error('Coolify deployment failed:', error instanceof Error ? error.message : 'Unknown error.')
	process.exitCode = 1
}
