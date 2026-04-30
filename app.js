const snap7 = require('node-snap7');

// `node app.js --write`: otomatik sayaç / simülasyon kapalı; S7 yazımları kalıcı kalır ve konsola yazılır
const WRITE_MODE = process.argv.includes('--write');

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
const WORD_AREA_SIZE = TAG_COUNT * TAG_SIZE; // 112 byte - Word tag'ler

// String tag'ler (S7 format: 1 byte max length, 1 byte current length, sonra karakterler)
const STRING_TAGS = [
    { offset: WORD_AREA_SIZE, maxLen: 20, initial: 'Merhaba S7' },           // Offset 112, 22 byte
    { offset: WORD_AREA_SIZE + 22, maxLen: 30, initial: 'S7 Simulator Server' }, // Offset 134, 32 byte
    { offset: WORD_AREA_SIZE + 54, maxLen: 20, initial: 'String Tag 3' },   // Offset 166, 22 byte
    { offset: WORD_AREA_SIZE + 76, maxLen: 14, initial: 'BurakDALKIRAN ', marquee: true }, // Kayan yazı, 16 byte
];
const STRING_AREA_SIZE = 22 + 32 + 22 + 16; // 92 byte
const TOTAL_SIZE = WORD_AREA_SIZE + STRING_AREA_SIZE; // 204 byte

// Kayan yazı: "BurakDALKIRAN " (metin + arada bir boşluk, sürekli sola kayar)
const MARQUEE_TEXT = 'BurakDALKIRAN '; // 13 karakter
let marqueePosition = 0;

// S7 string yazma: [maxLen, actualLen, ...chars]
function writeS7String(buffer, offset, maxLen, str) {
    const chars = Buffer.from(String(str), 'ascii').slice(0, maxLen);
    buffer[offset] = maxLen;
    buffer[offset + 1] = chars.length;
    chars.copy(buffer, offset + 2);
    // Kalan alanı 0 ile doldur
    for (let i = 2 + chars.length; i < 2 + maxLen; i++) {
        buffer[offset + i] = 0;
    }
}

// S7 string okuma
function readS7String(buffer, offset) {
    const maxLen = buffer[offset];
    const actualLen = buffer[offset + 1];
    return buffer.slice(offset + 2, offset + 2 + actualLen).toString('ascii');
}

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

// String tag'leri başlat
STRING_TAGS.forEach((tag, idx) => {
    writeS7String(db1Buffer, tag.offset, tag.maxLen, tag.initial);
});

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

if (!WRITE_MODE) {
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
        
        // İlk string tag'i her saniye güncelle (zaman damgası ekle - simülasyon)
        const tag = STRING_TAGS[0];
        const timeStr = new Date().toLocaleTimeString('tr-TR');
        writeS7String(db1Buffer, tag.offset, tag.maxLen, `Time: ${timeStr}`);
        
        // Kayan yazı string'ini güncelle (sola kayar, başa sarar; iki metin arasında bir boşluk)
        const marqueeTag = STRING_TAGS[3];
        const doubled = MARQUEE_TEXT + MARQUEE_TEXT; // 26 karakter, kaydırma için
        const visible = doubled.substring(marqueePosition, marqueePosition + MARQUEE_TEXT.length);
        writeS7String(db1Buffer, marqueeTag.offset, marqueeTag.maxLen, visible);
        marqueePosition = (marqueePosition + 1) % MARQUEE_TEXT.length; // 0..12, sonra başa sar
        
        // İlk 5 ve son 5 tag değerini göster (performans için)
        const firstFive = tagValues.slice(0, 5).join(', ');
        const lastFive = tagValues.slice(-5).join(', ');
        const merkerFirstFive = merkerValues.slice(0, 5).join(', ');
        const merkerLastFive = merkerValues.slice(-5).join(', ');
        // console.log(`DB1 Tag değerleri (ilk 5): [${firstFive}...] (son 5): [...${lastFive}]`);
        // console.log(`Merker (M) değerleri (ilk 5): [${merkerFirstFive}...] (son 5): [...${merkerLastFive}]`);
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
}

// Event handler'lar
s7server.on('event', function(event) {
    console.log('Event:', s7server.EventText(event));
});

s7server.on('readWrite', function(sender, operation, tagObj, buffer, callback) {
    if (operation === s7server.operationWrite) {
        const wlog = (...args) => {
            if (WRITE_MODE) console.log(...args);
        };
        // Write işlemi — buffer her modda güncellenir; ayrıntılı konsol çıktısı yalnızca --write ile
        const area = tagObj.Area;
        const dbNumber = tagObj.DBNumber;
        const start = tagObj.Start;
        const size = tagObj.Size;
        
        // Area tipini belirle
        let areaName = 'Unknown';
        if (area === s7server.srvAreaDB) areaName = 'DB';
        else if (area === s7server.srvAreaMK) areaName = 'Merker (M)';
        else if (area === s7server.srvAreaPE) areaName = 'PE (Input)';
        else if (area === s7server.srvAreaPA) areaName = 'PA (Output)';
        else if (area === s7server.srvAreaCT) areaName = 'CT (Counter)';
        else if (area === s7server.srvAreaTM) areaName = 'TM (Timer)';
        
        wlog(`\n=== WRITE İŞLEMİ ===`);
        wlog(`Sender: ${sender}`);
        wlog(`Area: ${areaName} (${area})`);
        wlog(`DB Number: ${dbNumber}`);
        wlog(`Start Offset: ${start} bytes`);
        wlog(`Size: ${size} bytes`);
        
        // Buffer içeriğini parse et (Word formatında - 2 byte)
        if (size >= 2 && size % 2 === 0) {
            const wordCount = size / 2;
            const values = [];
            const oldValues = [];
            
            // Eski değerleri oku (DB1 için)
            if (area === s7server.srvAreaDB && dbNumber === 1) {
                for (let i = 0; i < wordCount; i++) {
                    const offset = start + (i * 2);
                    if (offset < db1Buffer.length) {
                        oldValues.push(db1Buffer.readUInt16BE(offset));
                    }
                }
            }
            // Merker için eski değerleri oku
            else if (area === s7server.srvAreaMK) {
                for (let i = 0; i < wordCount; i++) {
                    const offset = start + (i * 2);
                    if (offset < merkerBuffer.length) {
                        oldValues.push(merkerBuffer.readUInt16BE(offset));
                    }
                }
            }
            
            // Yeni değerleri oku
            for (let i = 0; i < wordCount; i++) {
                const offset = i * 2;
                if (offset < buffer.length) {
                    values.push(buffer.readUInt16BE(offset));
                }
            }
            
            // Değerleri logla ve buffer'ları güncelle
            // DB1 string alanına yazıldıysa string olarak logla
            const isDb1StringArea = area === s7server.srvAreaDB && dbNumber === 1 && start >= WORD_AREA_SIZE;
            if (isDb1StringArea && size >= 2) {
                buffer.copy(db1Buffer, start, 0, Math.min(size, db1Buffer.length - start));
                s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
                const strContent = readS7String(buffer, 0);
                wlog(`\nYazılan String (Offset ${start}): "${strContent}"`);
            } else {
                wlog(`\nYazılan Word Değerleri (${wordCount} adet):`);
            }
            for (let i = 0; i < values.length; i++) {
                const tagIndex = Math.floor(start / 2) + i;
                const oldVal = oldValues[i] !== undefined ? oldValues[i] : 'N/A';
                const newVal = values[i];
                const changed = oldValues[i] !== undefined && oldValues[i] !== newVal ? ' ✓ DEĞİŞTİ' : '';
                if (!isDb1StringArea) {
                    wlog(`  Tag[${tagIndex}] (Offset ${start + (i * 2)}): ${oldVal} → ${newVal}${changed}`);
                }
                
                // Buffer'ları ve değer dizilerini güncelle (Word alanı için)
                if (area === s7server.srvAreaDB && dbNumber === 1 && start < WORD_AREA_SIZE) {
                    const offset = start + (i * 2);
                    if (offset < db1Buffer.length) {
                        // Buffer'a yaz
                        buffer.copy(db1Buffer, offset, i * 2, (i * 2) + 2);
                        // Değer dizisini güncelle
                        if (tagIndex < tagValues.length) {
                            tagValues[tagIndex] = newVal;
                        }
                    }
                } else if (area === s7server.srvAreaMK) {
                    const offset = start + (i * 2);
                    if (offset < merkerBuffer.length) {
                        // Buffer'a yaz
                        buffer.copy(merkerBuffer, offset, i * 2, (i * 2) + 2);
                        // Değer dizisini güncelle
                        if (tagIndex < merkerValues.length) {
                            merkerValues[tagIndex] = newVal;
                        }
                    }
                }
            }
            
            // Buffer güncellemesini server'a bildir
            if (area === s7server.srvAreaDB && dbNumber === 1) {
                s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
            } else if (area === s7server.srvAreaMK) {
                s7server.SetArea(s7server.srvAreaMK, 0, merkerBuffer);
            }
            
            // Hex dump göster (ilk 32 byte)
            const hexDumpSize = Math.min(size, 32);
            const hexValues = [];
            for (let i = 0; i < hexDumpSize; i++) {
                hexValues.push(buffer[i].toString(16).padStart(2, '0').toUpperCase());
            }
            wlog(`\nHex Dump (ilk ${hexDumpSize} byte):`);
            wlog(`  ${hexValues.join(' ')}`);
        } else {
            // Byte formatında göster ve buffer'ı güncelle
            const byteValues = [];
            for (let i = 0; i < Math.min(size, 32); i++) {
                byteValues.push(buffer[i]);
            }
            wlog(`\nYazılan Byte Değerleri (ilk ${Math.min(size, 32)} byte):`);
            wlog(`  ${byteValues.join(', ')}`);
            
            // Buffer'ı güncelle (byte formatında)
            if (area === s7server.srvAreaDB && dbNumber === 1) {
                if (start + size <= db1Buffer.length) {
                    buffer.copy(db1Buffer, start, 0, size);
                    s7server.SetArea(s7server.srvAreaDB, 1, db1Buffer);
                }
            } else if (area === s7server.srvAreaMK) {
                if (start + size <= merkerBuffer.length) {
                    buffer.copy(merkerBuffer, start, 0, size);
                    s7server.SetArea(s7server.srvAreaMK, 0, merkerBuffer);
                }
            }
        }
        
        wlog(`===================\n`);
    } else {
        // Read işlemi - sadece kısa log
        const area = tagObj.Area;
        let areaName = 'Unknown';
        if (area === s7server.srvAreaDB) areaName = 'DB';
        else if (area === s7server.srvAreaMK) areaName = 'Merker (M)';
        else if (area === s7server.srvAreaPE) areaName = 'PE (Input)';
        else if (area === s7server.srvAreaPA) areaName = 'PA (Output)';
        
        console.log(`Read işlemi - Sender: ${sender}, Area: ${areaName}, DB: ${tagObj.DBNumber}, Start: ${tagObj.Start}, Size: ${tagObj.Size}`);
    }
    
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
if (WRITE_MODE) {
    console.log('Mod: --write (otomatik sayaç / string / Merker simülasyonu KAPALI; S7 yazımları konsola yazılır)');
} else {
    console.log('Mod: simülasyon (otomatik tag artışları ve Merker rastgele güncelleme AÇIK)');
}
console.log(`IP: ${IP_ADDRESS}`);
console.log(`Port: 102`);
console.log(`Rack: 0, Slot: 1`);
console.log(`\n=== DB1 (Data Block 1) ===`);
console.log(`Tag sayısı: ${TAG_COUNT}`);
if (WRITE_MODE) {
    console.log('Otomatik tag artışı bu modda devre dışı; değerler istemci okuma/yazma ile belirlenir.');
} else {
    console.log(`Tag 1-${SECONDS_TAG_COUNT}: Her saniye 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 1}: Her 5 saniyede 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 2}: Her 10 saniyede 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 3}: Her 15 saniyede 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 4}: Her 20 saniyede 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 5}: Her 30 saniyede 1 artacak`);
    console.log(`Tag ${SECONDS_TAG_COUNT + 6}: Her 60 saniyede 1 artacak`);
}
console.log(`\nDB1 String tag'ler (S7 format, offset byte):`);
STRING_TAGS.forEach((tag, idx) => {
    const desc = tag.marquee ? 'kayan yazı (BurakDALKIRAN )' : `başlangıç: "${tag.initial}"`;
    console.log(`  String ${idx + 1}: Offset ${tag.offset}, max ${tag.maxLen} karakter, ${desc}`);
});
if (WRITE_MODE) {
    console.log('  (--write: string alanları otomatik güncellenmez; istemci yazabilir)');
} else {
    console.log(`  (String 1: her saniye zaman damgası | String 4: her saniye sola kayan yazı)`);
}
console.log(`\n=== Merker (M) Alanı ===`);
console.log(`Tag sayısı: ${MERKER_TAG_COUNT}`);
if (WRITE_MODE) {
    console.log('Merker bu modda otomatik rastgele güncellenmez; istemci yazabilir.\n');
} else {
    console.log(`Tag 0-${MERKER_TAG_COUNT - 1}: Her saniye rastgele değişecek (0-65535 arası)\n`);
}

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

