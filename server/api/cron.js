export default function handler(req, res) {
   console.log('before do');
	if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
		return res.status(401).end('Unauthorized')
	}
   console.log('do');
   
	res.end('Hello Cron!')
}
