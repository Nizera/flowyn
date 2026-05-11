const url = 'https://sandbox.asaas.com/api/v3/accounts';
const key = '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmU1MWJjNTlmLTIzOWEtNDFjMC1hMjBjLThjM2JlM2MwNzE1ZDo6JGFhY2hfNzE4YWY3ZDItYjEzMS00Mzc2LThjNzItN2EwMjdhYjQ5YmE5';

fetch(url, {
  headers: { 'access_token': key }
}).then(r => r.json()).then(d => {
  if (d.data && d.data.length > 0) {
    console.log("Keys available in account object:", Object.keys(d.data[0]));
    console.log("Has apiKey?", 'apiKey' in d.data[0]);
  } else {
    console.log(d);
  }
}).catch(console.error);
