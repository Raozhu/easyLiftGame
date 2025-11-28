import React from 'react';
import { GameEvent } from '../types';
import { Modal, Button } from './UIComponents';

interface EventModalProps {
  event: GameEvent;
  onChoice: (choiceIdx: number) => void;
}

const EventModal: React.FC<EventModalProps> = ({ event, onChoice }) => {
  return (
    <Modal title={event.title}>
      <div className="p-2 mb-6 text-gray-200 leading-relaxed text-lg">
        {event.description}
      </div>
      <div className="space-y-3">
        {event.choices.map((choice, idx) => (
          <Button 
            key={idx} 
            variant="secondary" 
            className="w-full text-left py-3 px-4 hover:bg-gray-600 border border-gray-600"
            onClick={() => onChoice(idx)}
          >
            {idx + 1}. {choice.text}
          </Button>
        ))}
      </div>
    </Modal>
  );
};

export default EventModal;
