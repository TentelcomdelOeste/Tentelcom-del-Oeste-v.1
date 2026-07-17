import React, { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
    onSignatureChange: (base64: string | null) => void;
    initialSignature?: string;
    disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureChange, initialSignature, disabled }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(!!initialSignature);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Set solid background
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';

                if (initialSignature) {
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = initialSignature;
                }
            }
        }
    }, [initialSignature]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || disabled) return;
        e.preventDefault(); // Prevent scrolling on touch
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
        const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onSignatureChange(canvas.toDataURL('image/png'));
        }
    };

    const clear = () => {
        if (disabled) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                setHasSignature(false);
                onSignatureChange(null);
            }
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white w-full max-w-sm mx-auto touch-none">
                <canvas
                    ref={canvasRef}
                    width={350}
                    height={150}
                    className="w-full h-[150px] cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            {!disabled && (
                <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] text-slate-500 font-medium">Dibuje su firma en el cuadro</span>
                    <button
                        type="button"
                        onClick={clear}
                        className="text-xs text-red-500 font-bold hover:text-red-700 transition-colors"
                    >
                        Limpiar firma
                    </button>
                </div>
            )}
        </div>
    );
};
