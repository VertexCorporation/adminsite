export function initDataExport() {

        // Verileri CSV/JSON Formatında Yerel Olarak Derleme ve İndirme Betiği
        window.exportDataLocal = function() {
            const dataType = document.getElementById('export-data-type').value;
            const format = document.getElementById('export-format').value;

            let rawData = null;
            let fileNamePrefix = '';

            if (dataType === 'contributors') {
                rawData = window.loadedContributors;
                fileNamePrefix = 'katilimci_basvurulari';
            } else if (dataType === 'manualModels') {
                rawData = window.loadedManualModels;
                fileNamePrefix = 'eklenen_modeller';
            } else if (dataType === 'allModels') {
                rawData = window.loadedAllModels;
                fileNamePrefix = 'tum_modeller_veritabani';
            } else if (dataType === 'articles') {
                rawData = window.loadedArticles;
                fileNamePrefix = 'yayinlanan_haberler';
            }

            if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
                if (dataType === 'allModels' && rawData && typeof rawData === 'object') {
                    // that's fine
                } else {
                    alert(window.__('system.export_no_data'));
                    return;
                }
            }

            let fileContent = '';
            let mimeType = '';
            let fileExtension = '';

            if (format === 'json') {
                fileContent = JSON.stringify(rawData, null, 2);
                mimeType = 'application/json';
                fileExtension = 'json';
            } else if (format === 'csv') {
                let itemsArray = [];
                if (dataType === 'allModels' && typeof rawData === 'object' && !Array.isArray(rawData)) {
                    if (rawData.producers) {
                        for (const pName in rawData.producers) {
                            for (const sName in rawData.producers[pName]) {
                                if (sName === 'series_description') continue;
                                for (const vName in rawData.producers[pName][sName]) {
                                    if (['series_description', 'hidden'].includes(vName)) continue;
                                    const model = rawData.producers[pName][sName][vName];
                                    if (model) {
                                        itemsArray.push({
                                            producer: pName,
                                            series: sName,
                                            variant: vName,
                                            id: model.id || '',
                                            source: model.source || '',
                                            type: model.type || ''
                                        });
                                    }
                                }
                            }
                        }
                    }
                } else {
                    itemsArray = Array.isArray(rawData) ? rawData : [rawData];
                }

                if (itemsArray.length === 0) {
                    alert(window.__('system.export_no_rows'));
                    return;
                }

                const keys = new Set();
                itemsArray.forEach(item => {
                    Object.keys(item).forEach(k => keys.add(k));
                });
                const headers = Array.from(keys);

                let csvRows = [];
                csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));

                itemsArray.forEach(item => {
                    const values = headers.map(header => {
                        let val = item[header];
                        if (val === undefined || val === null) {
                            return '""';
                        }
                        if (typeof val === 'object') {
                            val = JSON.stringify(val);
                        } else {
                            val = String(val);
                        }
                        return `"${val.replace(/"/g, '""')}"`;
                    });
                    csvRows.push(values.join(';'));
                });

                fileContent = '\uFEFF' + csvRows.join('\n');
                mimeType = 'text/csv;charset=utf-8;';
                fileExtension = 'csv';
            }

            const blob = new Blob([fileContent], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('href', url);
            link.setAttribute('download', `${fileNamePrefix}_${dateStr}.${fileExtension}`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Try triggering showToast
            if (window.showToast) {
                window.showToast(window.__('system.export_success'), 'success');
            } else {
                alert(window.__('system.export_downloaded'));
            }
        };
    
}
