# S7 Server

node-snap7 kullanılarak oluşturulmuş bir S7 server uygulaması.

## Özellikler

- Rack 0, Slot 1 konfigürasyonu
- 56 adet tag (DB1'de Word formatında)
- Tag 1-50: Her saniye 1 artar (1'den başlar)
- Tag 51: Her 5 saniyede 1 artar (1000'den başlar)
- Tag 52: Her 10 saniyede 1 artar (2000'den başlar)
- Tag 53: Her 15 saniyede 1 artar (3000'den başlar)
- Tag 54: Her 20 saniyede 1 artar (4000'den başlar)
- Tag 55: Her 30 saniyede 1 artar (5000'den başlar)
- Tag 56: Her 60 saniyede 1 artar (6000'den başlar)
- ISO-TCP port 102'de dinler
- Maksimum 10 eşzamanlı client bağlantısı

## Kurulum

```bash
npm install
```

veya

```bash
yarn install
```

## Kullanım

```bash
npm start
```

veya

```bash
node app.js
```

## Tag Yapısı

- **DB1**: Data Block 1
- **Toplam Tag Sayısı**: 56
- **Her Tag**: 2 byte (Word formatında, big-endian)
- **Toplam Buffer Boyutu**: 112 byte (56 tag × 2 byte)

### Tag Detayları

| Tag No | Offset | Güncelleme Aralığı | Başlangıç Değeri |
|--------|--------|-------------------|------------------|
| 1-50   | 0-98   | Her saniye        | 1-50             |
| 51     | 100    | Her 5 saniye      | 1000             |
| 52     | 102    | Her 10 saniye     | 2000             |
| 53     | 104    | Her 15 saniye     | 3000             |
| 54     | 106    | Her 20 saniye     | 4000             |
| 55     | 108    | Her 30 saniye     | 5000             |
| 56     | 110    | Her 60 saniye     | 6000             |

Her tag bir Word (16-bit) değeri tutar ve belirtilen aralıklarla otomatik olarak artar.

## Bağlantı Bilgileri

- **IP**: 0.0.0.0 (tüm ağ arayüzleri)
- **Port**: 102 (ISO-TCP)
- **Rack**: 0
- **Slot**: 1
- **Max Clients**: 10

## Event Handler'lar

Server aşağıdaki event'leri dinler:

- **event**: Server event'lerini loglar
- **readWrite**: Client'ların okuma/yazma işlemlerini loglar

## Notlar

- Server başlatıldığında tag değerleri belirtilen başlangıç değerlerinden başlar
- Tag 1-50 her saniye otomatik olarak artar
- Tag 51-56 farklı periyotlarla otomatik olarak artar
- Ctrl+C veya SIGTERM ile server durdurulabilir (graceful shutdown)
- Server durumu ve CPU durumu başlatıldığında konsola yazdırılır
