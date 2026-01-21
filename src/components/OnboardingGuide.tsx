import { useState, useEffect } from 'react';
import { FiX, FiUpload, FiFolder, FiSearch, FiCheck } from 'react-icons/fi';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  target?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: '欢迎使用文件管理系统',
    description: '这是一个强大的文件管理平台，支持图片、视频、3D模型等多种格式。让我们开始探索吧！',
    position: 'center',
  },
  {
    id: 2,
    title: '上传文件',
    description: '点击上传按钮或直接拖拽文件到页面即可上传。支持批量上传多个文件。',
    target: '[data-upload-button]',
    position: 'bottom',
  },
  {
    id: 3,
    title: '创建文件夹',
    description: '点击"+"按钮创建文件夹，帮助您更好地组织文件。',
    target: '[data-new-folder-button]',
    position: 'bottom',
  },
  {
    id: 4,
    title: '搜索文件',
    description: '使用搜索框快速查找文件。支持文件名搜索和高级筛选。',
    target: '[data-search-input]',
    position: 'bottom',
  },
  {
    id: 5,
    title: '开始使用',
    description: '现在您已经了解了基本功能，开始管理您的文件吧！',
    position: 'center',
  },
];

interface OnboardingGuideProps {
  onComplete: () => void;
}

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 检查是否已经完成过引导
    const hasCompleted = localStorage.getItem('bk-onboarding-completed');
    if (!hasCompleted) {
      setIsVisible(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem('bk-onboarding-completed', 'true');
    onComplete();
  };

  if (!isVisible) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-fade-in" />

      {/* 高亮目标元素 */}
      {step.target && (
        <div
          className="fixed z-[101] pointer-events-none"
          style={{
            // 这里需要动态计算目标元素的位置
            // 简化版本：使用overlay方式
          }}
        />
      )}

      {/* 引导卡片 */}
      <div className="fixed inset-0 z-[102] flex items-center justify-center pointer-events-none">
        <div className="bg-black/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-8 max-w-md mx-4 pointer-events-auto animate-fade-in">
          {/* 进度条 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">
                步骤 {currentStep + 1} / {ONBOARDING_STEPS.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 内容 */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              {step.id === 1 && <FiUpload className="text-cyan-400" size={24} />}
              {step.id === 2 && <FiUpload className="text-cyan-400" size={24} />}
              {step.id === 3 && <FiFolder className="text-cyan-400" size={24} />}
              {step.id === 4 && <FiSearch className="text-cyan-400" size={24} />}
              {step.id === 5 && <FiCheck className="text-green-400" size={24} />}
              <h3 className="text-xl font-semibold text-white">{step.title}</h3>
            </div>
            <p className="text-gray-300 leading-relaxed">{step.description}</p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between gap-4">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                上一步
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              跳过
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
            >
              {isLastStep ? '开始使用' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
