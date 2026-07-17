import React, { useEffect, useState } from 'react';
import { networkProbe } from './networkProbe';
import { FiWifiOff } from 'react-icons/fi';

export const OfflineStatusBar: React.FC = () => {
    const [isOnline, setIsOnline] = useState(networkProbe.isOnline());

    useEffect(() => {
        // networkProbe.subscribe immediately invokes with the current state and returns an unsubscribe function.
        const unsubscribe = networkProbe.subscribe(status => {
            setIsOnline(status);
        });

        return () => unsubscribe();
    }, []);

    // Let the existing UI operate without changes if we're online.
    if (isOnline) {
        return null; // Silent when online
    }

    return (
        <div className="bg-red-500 text-white text-[10px] md:text-xs px-2 py-1 flex items-center justify-center w-full z-[100] fixed top-0 left-0 shadow-md">
            <FiWifiOff className="mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="font-medium tracking-wide text-center">
                Sin conexión - Operando en modo Offline
            </span>
        </div>
    );
};
