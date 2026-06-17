const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5050,
    path: '/api/leads',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        const leads = JSON.parse(data);
        const converted = leads.filter(l => l.status === 'Converted');

        console.log('\n✅ Converted Leads with Amounts:');
        console.log('='.repeat(50));
        converted.forEach(lead => {
            console.log(`Name: ${lead.name}`);
            console.log(`Phone: ${lead.phone}`);
            console.log(`Amount: ${lead.membership?.amount || 'MISSING'}`);
            console.log(`Status: ${lead.status}`);
            console.log('-'.repeat(50));
        });
        console.log(`\nTotal converted leads: ${converted.length}`);
        console.log(`Total with amounts: ${converted.filter(l => l.membership?.amount).length}`);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
