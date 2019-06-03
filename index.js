const axios = require('axios');
const puppeteer = require('puppeteer');
const xl = require('excel4node');

(async () => {
    //enter username and password here
    let username = 'TestConsole';
    let password = 'TestConsole';

    //get bearer for request
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    let headersForBearer = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    let sendStrForBearer = `username=${username}&password=${password}&grant_type=password`;
    let bearerObj = {};
    await axios.post('https://dashboard.kyivcity.gov.ua/oauth/token', sendStrForBearer, {headers: headersForBearer})
        .then(res => bearerObj = res.data)
        .catch(err => console.log(err));
    let bearer = bearerObj.access_token;
    console.log('====================BEARER REQUEST FINISHED====================');

    //get urls from request
    let headersForUrls = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + bearer,
        'Accept': 'application/json, text/plain, */*'
    };
    let sendObjForUrls = {
        'queryCode': "SearchUserConsoleErrors",
        'limit': 999,
        'parameterValues': [{"key": "@UserName", "value": username}]
    };
    let dashboardArr = [];
    let urlsArr = [];
    await axios.post('https://dashboard.kyivcity.gov.ua/api/ds/utility/query/getvalues', sendObjForUrls, {headers: headersForUrls})
        .then(res => dashboardArr = res.data)
        .catch(err => console.log(err));
    dashboardArr = dashboardArr.rows.map(item => item.values[0]);
    console.log(dashboardArr);
    console.log('quantity of dashboards: ' + dashboardArr.length);
    console.log('====================URLS REQUEST FINISHED====================');

    //check for errors
    const browser = await puppeteer.launch();
    const headers = {'Authorization': 'Bearer ' + bearer};
    let errArr = [];
    let timeArr = [];
    let splice = [];
    for (let i = 0; i < dashboardArr.length; i++) {
        let oldTime = new Date();
        urlsArr.push('https://dashboard.kyivcity.gov.ua/dashboard/page/' + dashboardArr[i]);
        const url = urlsArr[i];
        console.log(url);
        const page = await browser.newPage();
        page.setExtraHTTPHeaders(headers);
        page.on('console', msg => {
            msg._args.map(item => {
                if (item._remoteObject.type === 'object' && item._remoteObject.subtype === 'error') {
                    let obj = {};
                    obj[url] = item._remoteObject.description;
                    splice.push(i);
                    errArr.push(obj);
                    console.log('error was founded')
                }
            })
        });
        page.setDefaultTimeout(0);
        await page.goto(url, {waitUntil: 'networkidle0'});
        let newTime = new Date();
        let spentTime = newTime - oldTime;
        timeArr.push(spentTime);
    }
    await browser.close();
    console.log('====================CHECKING FOR ERRORS FINISHED====================');

    //sort errors array
    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }
    let spliceAll = splice.filter(onlyUnique);
    for (let s = 0; s < spliceAll.length; s++) {
        urlsArr.splice(spliceAll[s] - s, 1);
    }
    for (let j = 0; j < urlsArr.length; j++) {
        let obj = {};
        obj[urlsArr[j]] = 'no errors';
        errArr.push(obj);
    }

    //write errors to file
    let wb = new xl.Workbook();
    let ws = wb.addWorksheet('Errors');
    for (let i = 0; i < errArr.length; i++) {
        for (let key in errArr[i]) {
            ws.cell(i + 1, 1)
                .string(key);
            ws.cell(i + 1, 2)
                .string(errArr[i][key])
                .style({alignment: {wrapText: true}});
        }
        ws.column(1).setWidth(75);
        ws.column(2).setWidth(100);
    }
    let ws2 = wb.addWorksheet('Load Time');
    for (let z = 0; z < dashboardArr.length; z++) {
        ws2.cell(z + 1, 1)
            .string(dashboardArr[z]);
        ws2.cell(z + 1, 2)
            .string(timeArr[z] / 1000 + ' sec')
            .style({alignment: {wrapText: true}});
        ws2.column(1).setWidth(75);
    }
    wb.write(`errors_by_user_(${username}).xlsx`);
    console.log('====================NEW FILE CREATED====================');
    console.log('====================ALL FINISHED====================');
})();