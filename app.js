const snap7 = require('node-snap7');

// S7 Server oluştur
const s7server = new snap7.S7Server();

// Rack ve Slot ayarları
// Not: node-snap7'de rack ve slot parametreleri doğrudan desteklenmeyebilir
// Ancak genellikle varsayılan olarak rack 0, slot 1 kullanılır

// Server parametrelerini ayarla
s7server.SetParam(s7server.LocalPort, 102); // ISO-TCP port (varsayılan 102)
s7server.SetParam(s7server.MaxClients, 10);

// Tag'ler için buffer'lar oluştur (her tag 2 byte - Word olarak)
// 50 tag her saniye + 6 tag farklı aralıklarla (5, 10, 15, 20, 30, 60 saniye)
const SECONDS_TAG_COUNT = 50; // Her saniye değişen tag sayısı
const PERIODIC_TAG_COUNT = 6; // Farklı aralıklarla değişen tag sayısı
const TAG_COUNT = SECONDS_TAG_COUNT + PERIODIC_TAG_COUNT; // Toplam 56 tag
const TAG_SIZE = 2; // Word = 2 bytes
const TOTAL_SIZE = TAG_COUNT * TAG_SIZE;

// Merker (M) alanı için ayarlar
const MERKER_TAG_COUNT = 50; // Merker'de 50 tag (her saniye rastgele değişecek)
const MERKER_TAG_SIZE = 2; // Word = 2 bytes
const MERKER_TOTAL_SIZE = MERKER_TAG_COUNT * MERKER_TAG_SIZE;

// DB1 alanını kaydet (Data Block 1)
const db1Buffer = Buffer.alloc(TOTAL_SIZE);

// Merker (M) alanını kaydet
const merkerBuffer = Buffer.alloc(MERKER_TOTAL_SIZE);

// Tag değerleri (her tag bir Word = 2 byte)
// Tag 0-49: Her saniye artan (1'den başlayarak)
// Tag 50: 5 saniyede bir (1000)
// Tag 51: 10 saniyede bir (2000)
// Tag 52: 15 saniyede bir (3000)
// Tag 53: 20 saniyede bir (4000)
// Tag 54: 30 saniyede bir (5000)
// Tag 55: 60 saniyede bir (6000)
let tagValues = [];
// Her saniye değişen 50 tag için başlangıç değerleri (1'den başlayarak)
for (let i = 0; i < SECONDS_TAG_COUNT; i++) {
    tagValues.push(i + 1);
}
// Periyodik tag'ler için başlangıç değerleri
tagValues.push(1000, 2000, 3000, 4000, 5000, 6000);

// Başlangıç değerlerini buffer'a yaz (Siemens S7 big-endian kullanır)
for (let i = 0; i < TAG_COUNT; i++) {
    const offset = i * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[i], offset);
}

s7server.RegisterArea(s7server.srvAreaDB, 1, db1Buffer);

// Merker başlangıç değerleri (rastgele)
let merkerValues = [];
for (let i = 0; i < MERKER_TAG_COUNT; i++) {
    merkerValues.push(Math.floor(Math.random() * 65535)); // 0-65535 arası rastgele (Word max değeri)
    const offset = i * MERKER_TAG_SIZE;
    merkerBuffer.writeUInt16BE(merkerValues[i], offset);
}

// Merker (M) alanını kaydet (DB numarası 0 kullanılır, Merker için genellikle index 0 kullanılır)
s7server.RegisterArea(s7server.srvAreaMK, merkerBuffer);

// Her saniye ilk 50 tag'i artır
setInterval(() => {
    for (let i = 0; i < SECONDS_TAG_COUNT; i++) {
        tagValues[i]++;
        
        // Word değerini buffer'a yaz (Siemens S7 big-endian kullanır)
        const offset = i * TAG_SIZE;
        db1Buffer.writeUInt16BE(tagValues[i], offset);
    }
    
    // Buffer'ı server'a yaz
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    
    // Merker alanı için rastgele değerler üret
    for (let i = 0; i < MERKER_TAG_COUNT; i++) {
        merkerValues[i] = Math.floor(Math.random() * 65535); // 0-65535 arası rastgele
        const offset = i * MERKER_TAG_SIZE;
        merkerBuffer.writeUInt16BE(merkerValues[i], offset);
    }
    
    // Merker buffer'ı server'a yaz
    s7server.SetArea(s7server.srvAreaMK, 0, merkerBuffer);
    
    // İlk 5 ve son 5 tag değerini göster (performans için)
    const firstFive = tagValues.slice(0, 5).join(', ');
    const lastFive = tagValues.slice(-5).join(', ');
    const merkerFirstFive = merkerValues.slice(0, 5).join(', ');
    const merkerLastFive = merkerValues.slice(-5).join(', ');
    console.log(`DB1 Tag değerleri (ilk 5): [${firstFive}...] (son 5): [...${lastFive}]`);
    console.log(`Merker (M) değerleri (ilk 5): [${merkerFirstFive}...] (son 5): [...${merkerLastFive}]`);
}, 1000);

// Her 5 saniyede Tag 50'yi artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT]++;
    const offset = SECONDS_TAG_COUNT * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 1} (5sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT]}`);
}, 5000);

// Her 10 saniyede Tag 51'i artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT + 1]++;
    const offset = (SECONDS_TAG_COUNT + 1) * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT + 1], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 2} (10sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT + 1]}`);
}, 10000);

// Her 15 saniyede Tag 52'yi artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT + 2]++;
    const offset = (SECONDS_TAG_COUNT + 2) * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT + 2], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 3} (15sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT + 2]}`);
}, 15000);

// Her 20 saniyede Tag 53'ü artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT + 3]++;
    const offset = (SECONDS_TAG_COUNT + 3) * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT + 3], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 4} (20sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT + 3]}`);
}, 20000);

// Her 30 saniyede Tag 54'ü artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT + 4]++;
    const offset = (SECONDS_TAG_COUNT + 4) * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT + 4], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 5} (30sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT + 4]}`);
}, 30000);

// Her 60 saniyede Tag 55'i artır
setInterval(() => {
    tagValues[SECONDS_TAG_COUNT + 5]++;
    const offset = (SECONDS_TAG_COUNT + 5) * TAG_SIZE;
    db1Buffer.writeUInt16BE(tagValues[SECONDS_TAG_COUNT + 5], offset);
    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
    console.log(`Tag ${SECONDS_TAG_COUNT + 6} (60sn) güncellendi: ${tagValues[SECONDS_TAG_COUNT + 5]}`);
}, 60000);

// Event handler'lar
s7server.on('event', function(event) {
    console.log('Event:', s7server.EventText(event));
});

s7server.on('readWrite', function(sender, operation, tagObj, buffer, callback) {
    const opType = operation === s7server.operationRead ? 'Read' : 'Write';
    console.log(`${opType} işlemi - Sender: ${sender}, Area: ${tagObj.Area}, DB: ${tagObj.DBNumber}, Start: ${tagObj.Start}, Size: ${tagObj.Size}`);
    
    if (operation === s7server.operationRead) {
        // Read işlemi için callback ile buffer döndür
        callback(buffer);
    } else {
        // Write işlemi için callback çağır
        callback();
    }
});

// Server'ı başlat
const IP_ADDRESS = '0.0.0.0'; // Tüm ağ arayüzlerinde dinle

console.log('S7 Server başlatılıyor...');
console.log(`IP: ${IP_ADDRESS}`);
console.log(`Port: 102`);
console.log(`Rack: 0, Slot: 1`);
console.log(`\n=== DB1 (Data Block 1) ===`);
console.log(`Tag sayısı: ${TAG_COUNT}`);
console.log(`Tag 1-${SECONDS_TAG_COUNT}: Her saniye 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 1}: Her 5 saniyede 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 2}: Her 10 saniyede 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 3}: Her 15 saniyede 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 4}: Her 20 saniyede 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 5}: Her 30 saniyede 1 artacak`);
console.log(`Tag ${SECONDS_TAG_COUNT + 6}: Her 60 saniyede 1 artacak`);
console.log(`\n=== Merker (M) Alanı ===`);
console.log(`Tag sayısı: ${MERKER_TAG_COUNT}`);
console.log(`Tag 0-${MERKER_TAG_COUNT - 1}: Her saniye rastgele değişecek (0-65535 arası)\n`);

s7server.StartTo(IP_ADDRESS, (err) => {
    if (err) {
        console.error('Server başlatılamadı:', err);
        console.error('Hata:', s7server.ErrorText(s7server.LastError()));
        process.exit(1);
    } else {
        console.log('✓ S7 Server başarıyla başlatıldı!');
        console.log('Server durumu:', s7server.ServerStatus() === s7server.SrvRunning ? 'Çalışıyor' : 'Durduruldu');
        console.log('CPU durumu:', s7server.GetCpuStatus() === s7server.S7CpuStatusRun ? 'Run' : 'Stop');
        console.log('\nServer çalışıyor. Çıkmak için Ctrl+C basın.\n');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nServer durduruluyor...');
    s7server.Stop((err) => {
        if (err) {
            console.error('Server durdurulurken hata:', err);
        } else {
            console.log('✓ Server başarıyla durduruldu.');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n\nServer durduruluyor...');
    s7server.Stop((err) => {
        if (err) {
            console.error('Server durdurulurken hata:', err);
        } else {
            console.log('✓ Server başarıyla durduruldu.');
        }
        process.exit(0);
    });
});

