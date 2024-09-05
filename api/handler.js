import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Converts a hexadecimal string to URL-safe Base64 encoding
const hexToBase64 = (hex) => {
    try {
        const bytes = Buffer.from(hex, 'hex');
        let base64 = bytes.toString('base64');
        base64 = base64.replace(/=*$/, '');
        return base64;
    } catch (error) {
        console.error('Error converting hex to base64:', error.message);
        return null;
    }
};

// Fetches data from a given URL
const fetchData = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Request failed:', error.message);
        throw error;
    }
};

// Fetches channel data and formats it
const fetchChannelData = async () => {
    const response = await fetchData('https://babel-in.xyz/babel-b2ef9ad8f0d432962d47009b24dee465/tata/channels');
    const channels = response?.data || [];

    return channels.map(channel => {
        let clearkeyData = null;
        if (channel.licence1 && channel.licence2) {
            const base64Licence1 = hexToBase64(channel.licence1);
            const base64Licence2 = hexToBase64(channel.licence2);
            clearkeyData = {
                keys: [{
                    kty: 'oct',
                    k: base64Licence2,
                    kid: base64Licence1
                }],
                type: 'temporary'
            };

            // Write clearkey data to a file (simulate hosted key)
            const clearkeyPath = path.resolve('./licenses', `${channel.id}.json`);
            fs.writeFileSync(clearkeyPath, JSON.stringify(clearkeyData));
        }

        return {
            id: channel.id,
            name: channel.title,
            tvg_id: channel.id,
            group_title: channel.genre || null,
            tvg_logo: channel.logo,
            stream_url: channel.initialUrl,
            license_url: clearkeyData ? `/api/license?id=${channel.id}` : null,
            clearkey: clearkeyData,
            pssh: channel.psshSet || null
        };
    });
};

// Fetches HMAC data
const fetchHmacData = async () => {
    const data = await fetchData('https://babel-in.xyz/babel-b2ef9ad8f0d432962d47009b24dee465/tata/hmac');
    return data?.data?.hdntl || null;
};

// Combines channel data with HMAC value
const combineData = (channels, hmacValue) => {
    return channels.map(channel => ({
        ...channel,
        hmac_value: hmacValue
    }));
};

// Generates M3U playlist string
const generateM3u = async () => {
    const channels = await fetchChannelData();
    const hmacValue = await fetchHmacData();
    const combinedData = combineData(channels, hmacValue);

    let m3uStr = '#EXTM3U x-tvg-url="https://raw.githubusercontent.com/mitthu786/tvepg/main/tataplay/epg.xml.gz"\n\n';
    combinedData.forEach(channel => {
        m3uStr += `#EXTINF:-1 tvg-id="${channel.tvg_id}" group-title="${channel.group_title}", tvg-logo="${channel.tvg_logo}", ${channel.name}\n`;
        m3uStr += '#KODIPROP:inputstream.adaptive.license_type=clearkey\n';
        m3uStr += `#KODIPROP:inputstream.adaptive.license_key=${channel.license_url}\n`;
        m3uStr += '#EXTVLCOPT:http-user-agent=Mozilla/5.0\n';
        m3uStr += `#EXTHTTP:{"cookie":"${channel.hmac_value}"}\n`;
        m3uStr += `${channel.stream_url}|cookie:${channel.hmac_value}\n\n`;
    });

    return m3uStr;
};

// API handler for serving M3U playlist
export default async function handler(req, res) {
    try {
        const m3uString = await generateM3u();
        res.status(200).send(m3uString);
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
}
