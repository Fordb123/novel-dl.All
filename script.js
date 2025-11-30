async function fetchNovelContent(url) {
    const response = await fetch(url);

    if (!response.ok) {
        console.error(`Error al obtener contenido de ${url}. Estado: ${response.status}`);
        return null;
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extraer título del episodio
    const titleElement = doc.querySelector('.toon-title');
    let episodeTitle = 'Episodio sin título';
    if (titleElement) {
        episodeTitle = titleElement.getAttribute('title') || 
                      titleElement.textContent.split('<br>')[0].trim() || 
                      'Episodio sin título';
    }

    const content = doc.querySelector('#novel_content');
    if (!content) {
        console.error(`No se encontró '#novel_content' en la página: ${url}`);
        return null;
    }

    let cleanedContent = cleanText(content.innerHTML);
    if (cleanedContent.startsWith(episodeTitle)) {
        cleanedContent = cleanedContent.slice(episodeTitle.length).trim();
    }

    return {
        episodeTitle: episodeTitle,
        content: cleanedContent
    };
}

function unescapeHTML(text) {
    const entities = {
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': "'",
        '&nbsp;': ' ',
        '&ndash;': '-',
        '&mdash;': '--',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&ldquo;': '"',
        '&rdquo;': '"'
    };

    Object.entries(entities).forEach(([entity, replacement]) => {
        const regex = new RegExp(entity, 'g');
        text = text.replace(regex, replacement);
    });

    return text;
}

function cleanText(text) {
    text = text.replace(/<div>/g, '');
    text = text.replace(/<\/div>/g, '');
    text = text.replace(/<p>/g, '\n');
    text = text.replace(/<\/p>/g, '\n');
    text = text.replace(/<br\s*[/]?>/g, '\n');
    text = text.replace(/<img[^>]*>/gi, '[imagen omitida]');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/ {2,}/g, ' ');
    text = unescapeHTML(text);

    text = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n');

    return text;
}

function createModal(title) {
    // Añadir estilos de animación al documento si no se han añadido ya
    if (!document.getElementById('novel-dl-styles')) {
        const style = document.createElement('style');
        style.id = 'novel-dl-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulse {
                0% { opacity: 0.7; }
                50% { opacity: 1; }
                100% { opacity: 0.7; }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Crear contenedor modal
    const modal = document.createElement('div');
    modal.id = 'downloadProgressModal';
    Object.assign(modal.style, {
        display: 'flex',
        position: 'fixed',
        zIndex: '9999',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });

    // Crear contenido modal
    const modalContent = document.createElement('div');
    Object.assign(modalContent.style, {
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        width: '450px',
        maxWidth: '90%',
        padding: '0',
        overflow: 'hidden',
        animation: 'fadeIn 0.3s'
    });

    // Crear encabezado
    const header = document.createElement('div');
    Object.assign(header.style, {
        backgroundColor: '#f9f9fb',
        borderBottom: '1px solid #eaecef',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    // Añadir título al encabezado
    const headerTitle = document.createElement('h3');
    headerTitle.textContent = title;
    Object.assign(headerTitle.style, {
        margin: '0',
        color: '#172238',
        fontSize: '16px',
        fontWeight: '600'
    });
    header.appendChild(headerTitle);
    
    // Añadir botón de cierre
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    Object.assign(closeButton.style, {
        background: 'none',
        border: 'none',
        fontSize: '22px',
        cursor: 'pointer',
        color: '#666',
        padding: '0 4px',
        lineHeight: '1'
    });
    closeButton.onclick = () => {
        if (confirm('¿Deseas cancelar la descarga?')) {
            document.body.removeChild(modal);
        }
    };
    header.appendChild(closeButton);
    
    modalContent.appendChild(header);

    // Crear cuerpo
    const body = document.createElement('div');
    Object.assign(body.style, {
        padding: '20px'
    });
    modalContent.appendChild(body);

    // Crear elemento de estado
    const statusElement = document.createElement('div');
    Object.assign(statusElement.style, {
        marginBottom: '16px',
        fontSize: '14px',
        color: '#444',
        fontWeight: '500'
    });
    body.appendChild(statusElement);

    // Crear elementos de información de progreso
    const progressInfo = document.createElement('div');
    Object.assign(progressInfo.style, {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px',
        fontSize: '14px',
        color: '#555'
    });
    
    const progressText = document.createElement('div');
    progressText.textContent = '0%';
    Object.assign(progressText.style, {
        fontWeight: '600'
    });
    progressInfo.appendChild(progressText);
    
    const timeRemaining = document.createElement('div');
    progressInfo.appendChild(timeRemaining);
    
    body.appendChild(progressInfo);

    // Crear contenedor de barra de progreso
    const progressBarContainer = document.createElement('div');
    Object.assign(progressBarContainer.style, {
        width: '100%',
        height: '8px',
        backgroundColor: '#eaecef',
        borderRadius: '8px',
        overflow: 'hidden'
    });
    
    // Crear barra de progreso
    const progressBar = document.createElement('div');
    Object.assign(progressBar.style, {
        width: '0%',
        height: '100%',
        background: 'linear-gradient(90deg, #3a7bd5, #6fa1ff)',
        borderRadius: '8px',
        transition: 'width 0.3s ease'
    });
    
    progressBarContainer.appendChild(progressBar);
    body.appendChild(progressBarContainer);

    // Crear elemento de progreso detallado
    const detailedProgress = document.createElement('div');
    Object.assign(detailedProgress.style, {
        marginTop: '16px',
        fontSize: '13px',
        color: '#666',
        textAlign: 'center'
    });
    body.appendChild(detailedProgress);

    modal.appendChild(modalContent);
    
    return {
        modal, 
        statusElement, 
        progressText, 
        timeRemaining, 
        progressBar, 
        detailedProgress
    };
}

// Función mejorada de estimación de tiempo con promedio móvil
function createProgressTracker(totalItems) {
    const startTime = Date.now();
    const processingTimes = [];
    const MAX_SAMPLES = 5; // Usar las últimas 5 muestras para el promedio móvil
    
    return {
        update: (completedItems) => {
            const progress = (completedItems / totalItems) * 100;
            
            const elapsed = Date.now() - startTime;
            
            // Calcular tiempo por elemento y almacenar para promedio móvil
            if (completedItems > 0) {
                const currentTimePerItem = elapsed / completedItems;
                processingTimes.push(currentTimePerItem);
                
                // Mantener solo las muestras más recientes
                if (processingTimes.length > MAX_SAMPLES) {
                    processingTimes.shift();
                }
            }
            
            // Calcular promedio móvil del tiempo de procesamiento
            const avgTimePerItem = processingTimes.length > 0 
                ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
                : 0;
            
            // Calcular tiempo restante basado en el promedio móvil
            const remainingItems = totalItems - completedItems;
            const estimatedRemainingTime = avgTimePerItem * remainingItems;
            
            return {
                progress: progress.toFixed(1),
                remaining: formatTime(estimatedRemainingTime),
                elapsed: formatTime(elapsed),
                speed: (avgTimePerItem > 0) ? (1000 / avgTimePerItem).toFixed(2) : "0.00" // Elementos por segundo
            };
        }
    };
}

function formatTime(ms) {
    if (ms < 1000) return "Por favor espera...";
    
    if (ms < 60000) {
        return `${Math.ceil(ms / 1000)} segundos`;
    } else if (ms < 3600000) {
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return `${mins} min ${secs} seg`;
    } else {
        const hours = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hours} h ${mins} min`;
    }
}

async function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '_');
}

async function downloadNovel(title, episodeLinks, startEpisode, endEpisode, delayMs = 5000) {
    // Crear un diálogo moderno para selección de opciones de guardado
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
        position: 'fixed',
        zIndex: '9999',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });

    const dialogContent = document.createElement('div');
    Object.assign(dialogContent.style, {
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        width: '350px',
        maxWidth: '90%',
        padding: '24px',
        animation: 'fadeIn 0.3s'
    });

    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = 'Seleccionar método de guardado';
    Object.assign(dialogTitle.style, {
        margin: '0 0 20px 0',
        color: '#172238',
        fontSize: '18px',
        fontWeight: '600'
    });
    dialogContent.appendChild(dialogTitle);

    const optionsContainer = document.createElement('div');
    Object.assign(optionsContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '24px'
    });

    const createOption = (value, text, description) => {
        const option = document.createElement('div');
        Object.assign(option.style, {
            padding: '14px',
            border: '1px solid #e4e9f0',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#f9f9fb',
            transition: 'all 0.2s ease'
        });
        
        option.innerHTML = `
            <div style="font-weight: 600; color: #172238; margin-bottom: 4px;">${text}</div>
            <div style="font-size: 13px; color: #666;">${description}</div>
        `;
        
        option.onclick = () => {
            document.body.removeChild(dialog);
            processDownload(value === '1' ? false : true);
        };
        
        option.onmouseover = () => {
            option.style.backgroundColor = '#f0f2f8';
            option.style.borderColor = '#3a7bd5';
        };
        
        option.onmouseout = () => {
            option.style.backgroundColor = '#f9f9fb';
            option.style.borderColor = '#e4e9f0';
        };
        
        return option;
    };

    optionsContainer.appendChild(createOption('1', 'Combinar en un archivo', 'Todos los capítulos se guardarán en un solo archivo.'));
    optionsContainer.appendChild(createOption('2', 'Guardar por capítulo (ZIP)', 'Cada capítulo se guardará como archivo individual en un ZIP.'));
    
    dialogContent.appendChild(optionsContainer);
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    Object.assign(cancelButton.style, {
        width: '100%',
        padding: '10px',
        border: '1px solid #e4e9f0',
        borderRadius: '8px',
        backgroundColor: '#f9f9fb',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s ease'
    });
    
    cancelButton.onmouseover = () => {
        cancelButton.style.backgroundColor = '#f0f2f8';
    };
    
    cancelButton.onmouseout = () => {
        cancelButton.style.backgroundColor = '#f9f9fb';
    };
    
    cancelButton.onclick = () => {
        document.body.removeChild(dialog);
    };
    
    dialogContent.appendChild(cancelButton);
    
    // Añadir enlace de contacto del desarrollador al final
    const contactContainer = document.createElement('div');
    Object.assign(contactContainer.style, {
        marginTop: '16px',
        textAlign: 'center',
        fontSize: '13px'
    });
    
    const contactLink = document.createElement('a');
    contactLink.href = 'mailto:yeorinhieut@gmail.com';
    contactLink.textContent = 'Contactar al desarrollador';
    Object.assign(contactLink.style, {
        color: '#666',
        textDecoration: 'none',
        borderBottom: '1px dotted #999'
    });
    
    contactLink.onmouseover = () => {
        contactLink.style.color = '#3a7bd5';
        contactLink.style.borderBottom = '1px dotted #3a7bd5';
    };
    
    contactLink.onmouseout = () => {
        contactLink.style.color = '#666';
        contactLink.style.borderBottom = '1px dotted #999';
    };
    
    contactContainer.appendChild(contactLink);
    
    // Añadir separador
    const separator = document.createElement('span');
    separator.textContent = ' · ';
    separator.style.color = '#999';
    contactContainer.appendChild(separator);
    
    // Añadir enlace para reportar problemas
    const issueLink = document.createElement('a');
    issueLink.href = 'https://github.com/yeorinhieut/novel-dl/issues';
    issueLink.textContent = 'Reportar error';
    issueLink.target = '_blank'; // Abrir en nueva pestaña
    Object.assign(issueLink.style, {
        color: '#666',
        textDecoration: 'none',
        borderBottom: '1px dotted #999'
    });
    
    issueLink.onmouseover = () => {
        issueLink.style.color = '#3a7bd5';
        issueLink.style.borderBottom = '1px dotted #3a7bd5';
    };
    
    issueLink.onmouseout = () => {
        issueLink.style.color = '#666';
        issueLink.style.borderBottom = '1px dotted #999';
    };
    
    contactContainer.appendChild(issueLink);
    dialogContent.appendChild(contactContainer);
    
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);

    async function processDownload(saveAsZip) {
        let zip;
        
        if (saveAsZip) {
            try {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
                zip = new JSZip();
            } catch (e) {
                alert('Error al cargar la librería ZIP');
                return;
            }
        }

        const startingIndex = episodeLinks.length - startEpisode;
        const endingIndex = episodeLinks.length - endEpisode;
        const totalEpisodes = startingIndex - endingIndex + 1;

        const {
            modal, 
            statusElement, 
            progressText, 
            timeRemaining, 
            progressBar, 
            detailedProgress
        } = createModal(`Descargando "${title}"`);
        
        document.body.appendChild(modal);
        
        // Inicializar el seguimiento de progreso
        const progressTracker = createProgressTracker(totalEpisodes);
        let novelText = `${title}\n\nDescargado con novel-dl,\nhttps://github.com/yeorinhieut/novel-dl\n\n`;
        let completedEpisodes = 0;
        let failedEpisodes = 0;
        let captchaCount = 0;

        statusElement.textContent = 'Preparando descarga...';
        
        for (let i = startingIndex; i >= endingIndex; i--) {
            const episodeUrl = episodeLinks[i];
            if (!episodeUrl.startsWith('https://booktoki')) {
                failedEpisodes++;
                continue;
            }

            const currentEpisode = startingIndex - i + 1;
            const episodeNumber = episodeLinks.length - i;
            statusElement.textContent = `Descargando capítulo ${episodeNumber}... (${currentEpisode}/${totalEpisodes})`;

            let result = await fetchNovelContent(episodeUrl);
            if (!result) {
                captchaCount++;
                statusElement.textContent = `⚠️ ¡CAPTCHA detectado! No se puede procesar el capítulo ${episodeNumber}.`;
                
                const userConfirmed = confirm(`¡CAPTCHA detectado!\n${episodeUrl}\n\nPor favor resuelve el CAPTCHA y haz clic en Aceptar.`);
                if (!userConfirmed) {
                    failedEpisodes++;
                    continue;
                }
                
                statusElement.textContent = `Reintentando capítulo ${episodeNumber}...`;
                result = await fetchNovelContent(episodeUrl);
                if (!result) {
                    statusElement.textContent = `❌ Error al descargar el capítulo ${episodeNumber}`;
                    failedEpisodes++;
                    continue;
                }
            }

            const {episodeTitle, content} = result;
            
            if (saveAsZip) {
                zip.file(`${sanitizeFilename(episodeTitle)}.txt`, content);
            } else {
                novelText += `${episodeTitle}\n\n${content}\n\n`;
            }

            completedEpisodes++;
            const stats = progressTracker.update(completedEpisodes);
            
            progressBar.style.width = `${stats.progress}%`;
            progressText.textContent = `${stats.progress}%`;
            timeRemaining.textContent = `Tiempo restante: ${stats.remaining}`;
            
            detailedProgress.innerHTML = `
                <div style="margin-bottom: 4px; display: flex; justify-content: center; gap: 12px;">
                    <span>✅ Completado: ${completedEpisodes} capítulos</span>
                    <span>❌ Fallido: ${failedEpisodes} capítulos</span>
                    <span>⚠️ CAPTCHA: ${captchaCount} veces</span>
                </div>
                <div>Tiempo transcurrido: ${stats.elapsed} | Velocidad: ${stats.speed} capítulos/seg</div>
            `;

            // Añadir retraso configurable para evitar limitación de velocidad
            await new Promise(r => setTimeout(r, delayMs));
        }

        statusElement.textContent = '✅ Descarga completada, generando archivo...';
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        setTimeout(() => {
            document.body.removeChild(modal);
            
            // Crear diálogo de finalización
            const completionDialog = document.createElement('div');
            Object.assign(completionDialog.style, {
                position: 'fixed',
                zIndex: '9999',
                left: '0',
                top: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
            });

            const completionContent = document.createElement('div');
            Object.assign(completionContent.style, {
                backgroundColor: '#fff',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                width: '400px',
                maxWidth: '90%',
                padding: '24px',
                animation: 'fadeIn 0.3s',
                textAlign: 'center'
            });
            
            // Icono de éxito
            const successIcon = document.createElement('div');
            successIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            Object.assign(successIcon.style, {
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '16px'
            });
            completionContent.appendChild(successIcon);
            
            // Título de finalización
            const completionTitle = document.createElement('h3');
            completionTitle.textContent = '¡Descarga completada!';
            Object.assign(completionTitle.style, {
                color: '#172238',
                fontSize: '18px',
                margin: '0 0 8px 0'
            });
            completionContent.appendChild(completionTitle);
            
            // Mensaje de finalización
            const completionMessage = document.createElement('p');
            completionMessage.textContent = `La descarga de ${completedEpisodes} capítulos está lista.`;
            Object.assign(completionMessage.style, {
                color: '#666',
                margin: '0 0 24px 0',
                fontSize: '14px'
            });
            completionContent.appendChild(completionMessage);
            
            // Botón de descarga
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Descargar';
            Object.assign(downloadBtn.style, {
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginBottom: '24px',
                width: '100%',
                transition: 'background-color 0.2s'
            });
            
            downloadBtn.onmouseover = () => {
                downloadBtn.style.backgroundColor = '#388E3C';
            };
            
            downloadBtn.onmouseout = () => {
                downloadBtn.style.backgroundColor = '#4CAF50';
            };
            
            downloadBtn.onclick = () => {
                if (saveAsZip) {
                    zip.generateAsync({type: 'blob'}).then(blob => {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `${sanitizeFilename(title)}.zip`;
                        a.click();
                        
                        // Mostrar notificación de éxito después de hacer clic en descargar
                        showNotification(`Iniciando descarga de "${title}"`, `${completedEpisodes} capítulos se guardarán como archivo ZIP.`);
                        document.body.removeChild(completionDialog);
                    });
                } else {
                    const blob = new Blob([novelText], {type: 'text/plain'});
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${sanitizeFilename(title)}(${startEpisode}~${endEpisode}).txt`;
                    a.click();
                    
                    // Mostrar notificación de éxito después de hacer clic en descargar
                    showNotification(`Iniciando descarga de "${title}"`, `${completedEpisodes} capítulos se guardarán como archivo de texto.`);
                    document.body.removeChild(completionDialog);
                }
            };
            
            completionContent.appendChild(downloadBtn);
            
            // Enlace de contacto del desarrollador
            const contactLink = document.createElement('a');
            contactLink.href = 'mailto:yeorinhieut@gmail.com';
            contactLink.textContent = 'Contactar al desarrollador';
            Object.assign(contactLink.style, {
                display: 'inline-block',
                color: '#666',
                fontSize: '13px',
                textDecoration: 'none',
                borderBottom: '1px dotted #999'
            });
            
            contactLink.onmouseover = () => {
                contactLink.style.color = '#3a7bd5';
                contactLink.style.borderBottom = '1px dotted #3a7bd5';
            };
            
            contactLink.onmouseout = () => {
                contactLink.style.color = '#666';
                contactLink.style.borderBottom = '1px dotted #999';
            };
            
            completionContent.appendChild(contactLink);
            
            // Añadir separador
            const separator = document.createElement('span');
            separator.textContent = ' · ';
            separator.style.color = '#999';
            completionContent.appendChild(separator);
            
            // Añadir enlace para reportar problemas
            const issueLink = document.createElement('a');
            issueLink.href = 'https://github.com/yeorinhieut/novel-dl/issues';
            issueLink.textContent = 'Reportar error';
            issueLink.target = '_blank'; // Abrir en nueva pestaña
            Object.assign(issueLink.style, {
                color: '#666',
                fontSize: '13px',
                textDecoration: 'none',
                borderBottom: '1px dotted #999'
            });
            
            issueLink.onmouseover = () => {
                issueLink.style.color = '#3a7bd5';
                issueLink.style.borderBottom = '1px dotted #3a7bd5';
            };
            
            issueLink.onmouseout = () => {
                issueLink.style.color = '#666';
                issueLink.style.borderBottom = '1px dotted #999';
            };
            
            completionContent.appendChild(issueLink);
            
            completionDialog.appendChild(completionContent);
            document.body.appendChild(completionDialog);
        }, 500);
    }
}

function showNotification(title, message) {
    const notification = document.createElement('div');
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: '#fff',
        borderLeft: '4px solid #4CAF50',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '16px',
        zIndex: '9999',
        maxWidth: '320px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        animation: 'fadeIn 0.3s'
    });
    
    notification.innerHTML = `
        <div style="font-weight: 600; color: #172238; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 13px; color: #666;">${message}</div>
    `;
    
    document.body.appendChild(notification);
    
    // Eliminar automáticamente después de 5 segundos
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 5000);
}

function extractTitle() {
    const titleElement = document.evaluate('//*[@id="content_wrapper"]/div[1]/span', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    return titleElement ? titleElement.textContent.trim() : null;
}

function extractEpisodeLinks() {
    const episodeLinks = [];
    const links = document.querySelectorAll('.item-subject');

    links.forEach(link => {
        const episodeLink = link.getAttribute('href');
        episodeLinks.push(episodeLink);
    });

    return episodeLinks;
}

async function fetchPage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`Error al obtener página: ${url}. Estado: ${response.status}`);
        return null;
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc;
}

async function runCrawler() {
    const novelPageRule = 'https://booktoki';
    let currentUrl = window.location.href;

    // Limpiar URL
    const urlParts = currentUrl.split('?')[0];
    currentUrl = urlParts;

    if (!currentUrl.startsWith(novelPageRule)) {
        alert('Este script debe ejecutarse en la página de lista de novelas de booktoki.');
        return;
    }

    const title = extractTitle();

    if (!title) {
        alert('No se pudo extraer el título de la novela.');
        return;
    }

    // Crear una interfaz de usuario moderna para la entrada
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
        position: 'fixed',
        zIndex: '9999',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    });

    const dialogContent = document.createElement('div');
    Object.assign(dialogContent.style, {
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        width: '400px',
        maxWidth: '90%',
        padding: '24px',
        animation: 'fadeIn 0.3s'
    });

    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = `Configuración de descarga de "${title}"`;
    Object.assign(dialogTitle.style, {
        margin: '0 0 20px 0',
        color: '#172238',
        fontSize: '18px',
        fontWeight: '600'
    });
    dialogContent.appendChild(dialogTitle);

    // Función para crear grupos de entrada
    function createInputGroup(labelText, inputType, defaultValue, placeholder, description) {
        const group = document.createElement('div');
        Object.assign(group.style, {
            marginBottom: '20px'
        });
        
        const label = document.createElement('label');
        label.textContent = labelText;
        Object.assign(label.style, {
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#444',
            fontWeight: '500'
        });
        group.appendChild(label);
        
        if (description) {
            const desc = document.createElement('div');
            desc.textContent = description;
            Object.assign(desc.style, {
                fontSize: '13px',
                color: '#666',
                marginBottom: '8px'
            });
            group.appendChild(desc);
        }
        
        const input = document.createElement('input');
        input.type = inputType;
        input.value = defaultValue;
        input.placeholder = placeholder || '';
        Object.assign(input.style, {
            width: '100%',
            padding: '10px',
            border: '1px solid #e4e9f0',
            borderRadius: '8px',
            fontSize: '14px',
            boxSizing: 'border-box'
        });
        group.appendChild(input);
        
        return { group, input };
    }

    // Entrada de páginas
    const pagesInput = createInputGroup(
        'Número de páginas de la lista de novelas', 
        'number', 
        '1', 
        'Introducir número de páginas', 
        'Usar 1 si hay menos de 1000 episodios, usar 2+ si hay más de 1000 episodios'
    );
    dialogContent.appendChild(pagesInput.group);
    pagesInput.input.min = 1;

    // Contenedor de botones
    const buttonsContainer = document.createElement('div');
    Object.assign(buttonsContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '16px',
        gap: '12px'
    });

    // Botón de cancelar
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancelar';
    Object.assign(cancelButton.style, {
        flex: '1',
        padding: '10px',
        border: '1px solid #e4e9f0',
        borderRadius: '8px',
        backgroundColor: '#f9f9fb',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s ease'
    });
    
    cancelButton.onmouseover = () => {
        cancelButton.style.backgroundColor = '#f0f2f8';
    };
    
    cancelButton.onmouseout = () => {
        cancelButton.style.backgroundColor = '#f9f9fb';
    };
    
    cancelButton.onclick = () => document.body.removeChild(dialog);
    buttonsContainer.appendChild(cancelButton);

    // Botón de continuar
    const continueButton = document.createElement('button');
    continueButton.textContent = 'Continuar';
    Object.assign(continueButton.style, {
        flex: '1',
        padding: '10px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#3a7bd5',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        transition: 'all 0.2s ease'
    });
    
    continueButton.onmouseover = () => {
        continueButton.style.backgroundColor = '#2d62aa';
    };
    
    continueButton.onmouseout = () => {
        continueButton.style.backgroundColor = '#3a7bd5';
    };
    
    buttonsContainer.appendChild(continueButton);

    dialogContent.appendChild(buttonsContainer);
    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);

    // Manejar clic en el botón continuar
    continueButton.onclick = async () => {
        const totalPages = parseInt(pagesInput.input.value, 10);

        if (isNaN(totalPages) || totalPages < 1) {
            alert('Por favor, introduce un número de páginas válido.');
            return;
        }

        document.body.removeChild(dialog);

        // Mostrar diálogo de carga
        const loadingDialog = document.createElement('div');
        Object.assign(loadingDialog.style, {
            position: 'fixed',
            zIndex: '9999',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        });

        const loadingContent = document.createElement('div');
        Object.assign(loadingContent.style, {
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            width: '300px',
            maxWidth: '90%',
            padding: '24px',
            textAlign: 'center'
        });

        const loadingTitle = document.createElement('h3');
        loadingTitle.textContent = 'Cargando lista de episodios';
        Object.assign(loadingTitle.style, {
            margin: '0 0 16px 0',
            color: '#172238',
            fontSize: '16px',
            fontWeight: '600'
        });
        loadingContent.appendChild(loadingTitle);

        const loadingText = document.createElement('p');
        loadingText.textContent = 'Por favor espera...';
        Object.assign(loadingText.style, {
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: '#555'
        });
        loadingContent.appendChild(loadingText);

        // Crear animación de carga
        const spinnerContainer = document.createElement('div');
        Object.assign(spinnerContainer.style, {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '16px'
        });
        
        const spinner = document.createElement('div');
        Object.assign(spinner.style, {
            width: '32px',
            height: '32px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3a7bd5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        });
        
        spinnerContainer.appendChild(spinner);
        loadingContent.appendChild(spinnerContainer);

        loadingDialog.appendChild(loadingContent);
        document.body.appendChild(loadingDialog);

        // Obtener todos los enlaces de episodios con actualizaciones de progreso
        const allEpisodeLinks = [];
        for (let page = 1; page <= totalPages; page++) {
            loadingText.textContent = `Cargando página ${page}/${totalPages}...`;
            const nextPageUrl = `${currentUrl}?spage=${page}`;
            const nextPageDoc = await fetchPage(nextPageUrl);
            if (nextPageDoc) {
                const nextPageLinks = Array.from(nextPageDoc.querySelectorAll('.item-subject')).map(link => link.getAttribute('href'));
                allEpisodeLinks.push(...nextPageLinks);
                loadingText.textContent = `${allEpisodeLinks.length} episodios encontrados`;
            }
            // Pequeño retraso para evitar limitación de velocidad
            await new Promise(r => setTimeout(r, 500));
        }

        document.body.removeChild(loadingDialog);

        if (allEpisodeLinks.length === 0) {
            alert('No se pudo obtener la lista de episodios.');
            return;
        }

        // Crear diálogo de rango de episodios
        const rangeDialog = document.createElement('div');
        Object.assign(rangeDialog.style, {
            position: 'fixed',
            zIndex: '9999',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        });

        const rangeContent = document.createElement('div');
        Object.assign(rangeContent.style, {
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            width: '400px',
            maxWidth: '90%',
            padding: '24px',
            animation: 'fadeIn 0.3s'
        });

        const rangeTitle = document.createElement('h3');
        rangeTitle.textContent = 'Configurar rango de descarga';
        Object.assign(rangeTitle.style, {
            margin: '0 0 16px 0',
            color: '#172238',
            fontSize: '18px',
            fontWeight: '600'
        });
        rangeContent.appendChild(rangeTitle);

        const episodeCount = document.createElement('div');
        episodeCount.innerHTML = `<span style="display: inline-block; background-color: #ebf5ff; color: #3a7bd5; padding: 4px 8px; border-radius: 4px; font-weight: 500;">Se encontraron ${allEpisodeLinks.length} episodios en total.</span>`;
        Object.assign(episodeCount.style, {
            margin: '0 0 20px 0',
            fontSize: '14px'
        });
        rangeContent.appendChild(episodeCount);

        // Entrada de episodio inicial
        const startInput = createInputGroup('Episodio inicial', 'number', '1', 'Número de episodio inicial');
        rangeContent.appendChild(startInput.group);
        startInput.input.min = 1;
        startInput.input.max = allEpisodeLinks.length;

        // Entrada de episodio final
        const endInput = createInputGroup('Episodio final', 'number', allEpisodeLinks.length.toString(), 'Número de episodio final');
        rangeContent.appendChild(endInput.group);
        endInput.input.min = 1;
        endInput.input.max = allEpisodeLinks.length;
        
        // Entrada de retraso con advertencia
        const delayInput = createInputGroup(
            'Configurar retraso (milisegundos)', 
            'number', 
            '5000', 
            'Introducir retraso', 
            '⚠️ Recomendado: mantener el valor predeterminado (5000ms=5s). Cambiarlo aumenta el riesgo de bloqueo.'
        );
        rangeContent.appendChild(delayInput.group);
        delayInput.input.min = 1000;
        delayInput.input.style.border = '1px solid #ffcc00';
        delayInput.input.style.backgroundColor = '#fffbf0';

        // Botones de rango
        const rangeButtons = document.createElement('div');
        Object.assign(rangeButtons.style, {
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '20px',
            gap: '12px'
        });

        // Botón de cancelar
        const rangeCancelButton = document.createElement('button');
        rangeCancelButton.textContent = 'Cancelar';
        Object.assign(rangeCancelButton.style, {
            flex: '1',
            padding: '10px',
            border: '1px solid #e4e9f0',
            borderRadius: '8px',
            backgroundColor: '#f9f9fb',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
        });
        
        rangeCancelButton.onmouseover = () => {
            rangeCancelButton.style.backgroundColor = '#f0f2f8';
        };
        
        rangeCancelButton.onmouseout = () => {
            rangeCancelButton.style.backgroundColor = '#f9f9fb';
        };
        
        rangeCancelButton.onclick = () => document.body.removeChild(rangeDialog);
        rangeButtons.appendChild(rangeCancelButton);

        // Botón de descarga
        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Descargar';
        Object.assign(downloadButton.style, {
            flex: '1',
            padding: '10px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#3a7bd5',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
        });
        
        downloadButton.onmouseover = () => {
            downloadButton.style.backgroundColor = '#2d62aa';
        };
        
        downloadButton.onmouseout = () => {
            downloadButton.style.backgroundColor = '#3a7bd5';
        };
        
        rangeButtons.appendChild(downloadButton);

        rangeContent.appendChild(rangeButtons);
        
        // Añadir enlace de contacto del desarrollador al final
        const contactContainer = document.createElement('div');
        Object.assign(contactContainer.style, {
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '13px'
        });
        
        const contactLink = document.createElement('a');
        contactLink.href = 'mailto:yeorinhieut@gmail.com';
        contactLink.textContent = 'Contactar al desarrollador';
        Object.assign(contactLink.style, {
            color: '#666',
            textDecoration: 'none',
            borderBottom: '1px dotted #999'
        });
        
        contactLink.onmouseover = () => {
            contactLink.style.color = '#3a7bd5';
            contactLink.style.borderBottom = '1px dotted #3a7bd5';
        };
        
        contactLink.onmouseout = () => {
            contactLink.style.color = '#666';
            contactLink.style.borderBottom = '1px dotted #999';
        };
        
        contactContainer.appendChild(contactLink);
        
        // Añadir separador
        const separator = document.createElement('span');
        separator.textContent = ' · ';
        separator.style.color = '#999';
        contactContainer.appendChild(separator);
        
        // Añadir enlace para reportar problemas
        const issueLink = document.createElement('a');
        issueLink.href = 'https://github.com/yeorinhieut/novel-dl/issues';
        issueLink.textContent = 'Reportar error';
        issueLink.target = '_blank'; // Abrir en nueva pestaña
        Object.assign(issueLink.style, {
            color: '#666',
            textDecoration: 'none',
            borderBottom: '1px dotted #999'
        });
        
        issueLink.onmouseover = () => {
            issueLink.style.color = '#3a7bd5';
            issueLink.style.borderBottom = '1px dotted #3a7bd5';
        };
        
        issueLink.onmouseout = () => {
            issueLink.style.color = '#666';
            issueLink.style.borderBottom = '1px dotted #999';
        };
        
        contactContainer.appendChild(issueLink);
        rangeContent.appendChild(contactContainer);
        
        rangeDialog.appendChild(rangeContent);
        document.body.appendChild(rangeDialog);

        // Manejar clic en el botón de descarga
        downloadButton.onclick = () => {
            const startEpisode = parseInt(startInput.input.value, 10);
            const endEpisode = parseInt(endInput.input.value, 10);

            if (isNaN(startEpisode) || isNaN(endEpisode) || 
                startEpisode < 1 || 
                endEpisode < startEpisode || 
                endEpisode > allEpisodeLinks.length) {
                alert('Por favor, introduce un rango de episodios válido.');
                return;
            }

            const delay = parseInt(delayInput.input.value, 10);
            if (isNaN(delay) || delay < 1000) {
                alert('Por favor, introduce un valor de retraso válido. (mínimo 1000ms)');
                return;
            }

            document.body.removeChild(rangeDialog);

            console.log(`Tarea añadida: Preparando descarga de ${title} desde el episodio ${startEpisode} hasta el ${endEpisode}`);

            downloadNovel(title, allEpisodeLinks, startEpisode, endEpisode, delay);
        };
    };
}

runCrawler();
