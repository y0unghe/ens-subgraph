const gr = require('graphql-request')
const { request, gql } = gr
const url = 'http://127.0.0.1:8000/subgraphs/name/graphprotocol/ens'
const GET_LABEL_NAME = gql`
  query {
    registrations(first: 5, where: { labelName: "released" }) {
      labelName
    }
  }
`

async function waitUntil(condition) {
    let counter = 0
    const retrynum = 100
    return await new Promise(resolve => {
      const interval = setInterval(() => {
        console.log(counter)
        if(counter === 100){
          throw(`Timing out after ${retrynum} attempt`)
        }
        if (condition) {
          resolve('foo');
          clearInterval(interval);
        };
        counter = counter+1
      }, 1000);
    });
  }

async function main() {
  let data
  try{  
    data = await request(url, GET_LABEL_NAME)
    console.log(data.registrations)
  }catch(e){
  }finally{
    waitUntil(data?.registrations[0].labelName === 'released')
  }
}
main()

