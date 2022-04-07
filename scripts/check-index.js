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
async function main() {
  let counter = 0
  let data
  const interval = setInterval(async() => {
    if(counter % 10 === 0){
      console.log(counter)
    }
    if(counter === 600){
      throw(`Timing out after ${retrynum} attempt`)
    }
    try{
      data = await request(url, GET_LABEL_NAME)
      console.log(data)
      if (data?.registrations[0].labelName === 'released') {
        clearInterval(interval);
      };
    }catch(e){
      // console.log({e})
    }finally{
      counter = counter+1
    }
  }, 1000);
}
main()

